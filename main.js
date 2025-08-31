const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');
const { generateMessage } = require('./gpt');

async function main() {
  const { default: inquirer } = await import('inquirer');
  const answers = await inquirer.prompt([
    {
      name: 'gitPath',
      message: '.git 폴더가 있는 프로젝트 경로를 입력하세요:',
      validate(input) {
        // 입력 경로에 .git 디렉터리가 실제로 존재하는지 확인
        const gitDir = path.join(input, '.git');
        if (fs.existsSync(gitDir) && fs.lstatSync(gitDir).isDirectory()) {
          return true;
        }
        return '유효한 .git 폴더가 있는 경로를 입력하세요.';
      },
    },
    {
      name: 'startDate',
      message: '시작 날짜를 입력하세요 (YYYY-MM-DD 형식):',
      validate(input) {
        // YYYY-MM-DD 형식 검증
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(input.trim())) {
          return 'YYYY-MM-DD 형식으로 입력하세요 (예: 2024-01-01).';
        }
        const date = new Date(input.trim());
        if (isNaN(date.getTime())) {
          return '유효한 날짜를 입력하세요.';
        }
        return true;
      },
    },
    {
      name: 'endDate',
      message: '종료 날짜를 입력하세요 (YYYY-MM-DD 형식):',
      validate(input) {
        // YYYY-MM-DD 형식 검증
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(input.trim())) {
          return 'YYYY-MM-DD 형식으로 입력하세요 (예: 2024-01-31).';
        }
        const date = new Date(input.trim());
        if (isNaN(date.getTime())) {
          return '유효한 날짜를 입력하세요.';
        }
        return true;
      },
    },
    {
      name: 'author',
      message: '작성자 이름을 입력하세요 (선택 사항, 전체는 비워두세요):',
    },
  ]);

  const git = simpleGit(answers.gitPath);

  try {
    console.log('\n==== 입력한 정보 ====');
    console.log(`경로: ${answers.gitPath}`);
    console.log(`시작 날짜: ${answers.startDate}`);
    console.log(`종료 날짜: ${answers.endDate}`);
    if (answers.author) {
      console.log(`작성자: ${answers.author}`);
    }

    // 날짜 유효성 검증
    const startDate = new Date(answers.startDate);
    const endDate = new Date(answers.endDate);

    if (startDate > endDate) {
      console.error('시작 날짜가 종료 날짜보다 늦습니다.');
      return;
    }

    // 조회 기간이 두 달을 초과하는지 확인
    const twoMonthsLater = new Date(startDate);
    twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);

    if (endDate > twoMonthsLater) {
      console.error(
        '조회 기간은 최대 두 달을 넘을 수 없습니다. 토큰 사용량이 너무 많아질 수 있습니다.'
      );
      return;
    }

    console.log('\n==== 기간 내 커밋 조회 중... ====');

    // 기간 내 커밋 목록 조회
    const logOptions = {
      '--since': answers.startDate,
      '--until': answers.endDate,
      format: {
        hash: '%H',
        date: '%ai',
        message: '%s',
        author_name: '%an',
        author_email: '%ae',
      },
    };

    if (answers.author) {
      logOptions['--author'] = answers.author;
    }

    const commits = await git.log(logOptions);

    if (!commits.all || commits.all.length === 0) {
      console.log('지정된 기간에 커밋이 없습니다.');
      return;
    }

    console.log(`총 ${commits.all.length}개의 커밋을 찾았습니다.`);

    // 날짜별로 커밋 그룹화
    const commitsByDate = {};

    for (const commit of commits.all) {
      const commitDate = new Date(commit.date).toISOString().split('T')[0]; // YYYY-MM-DD 형식
      if (!commitsByDate[commitDate]) {
        commitsByDate[commitDate] = [];
      }
      commitsByDate[commitDate].push(commit);
    }

    // 각 날짜별로 처리
    for (const [date, dateCommits] of Object.entries(commitsByDate)) {
      console.log(`\n==== ${date} 커밋 처리 중 (${dateCommits.length}개) ====`);

      let dailyReport = `# ${date} 커밋 리포트\n\n`;
      dailyReport += `총 ${dateCommits.length}개의 커밋\n\n`;

      for (let i = 0; i < dateCommits.length; i++) {
        const commit = dateCommits[i];
        console.log(
          `  처리 중: ${commit.hash.substring(0, 7)} - ${commit.message}`
        );

        try {
          // 각 커밋의 상세 정보 조회
          const showResult = await git.show([
            '--quiet',
            '--pretty=format:%B', // 커밋 메시지만 표시
            '--patch',
            '--stat',
            commit.hash,
          ]);

          // AI 요약 생성
          const aiSummary = await generateMessage(
            '아래 커밋 메시지와 변경사항을 분석해서 무엇을 했는지 간결하게 설명해줘:\n\n' +
              showResult
          );

          // 일일 리포트에 추가
          dailyReport += `## 커밋 ${i + 1}: ${commit.hash.substring(0, 7)}\n`;
          // dailyReport += `**작성자**: ${commit.author_name} <${commit.author_email}>\n`;
          // dailyReport += `**시간**: ${commit.date}\n`;
          dailyReport += `**메시지**: ${commit.message}\n\n`;
          dailyReport += `### AI 요약\n${aiSummary}\n\n`;
          // dailyReport += `### 상세 변경사항\n\`\`\`\n${showResult}\n\`\`\`\n\n`;
          dailyReport += '---\n\n';
        } catch (commitErr) {
          console.error(`커밋 ${commit.hash} 처리 중 오류:`, commitErr);
          dailyReport += `## 커밋 ${i + 1}: ${commit.hash.substring(
            0,
            7
          )} (오류 발생)\n`;
          dailyReport += `**오류**: ${commitErr.message}\n\n`;
        }
      }

      // 날짜별 파일 저장
      const fileName = `commit-report-${date}.md`;
      const outPath = path.join(answers.gitPath, fileName);

      try {
        fs.writeFileSync(outPath, dailyReport, 'utf8');
        console.log(`[저장 완료] ${date} 리포트: ${outPath}`);
      } catch (fileErr) {
        console.error(`${date} 리포트 저장 중 오류:`, fileErr);
      }
    }

    console.log('\n==== 모든 처리 완료 ====');
    console.log('각 날짜별로 마크다운 파일이 생성되었습니다.');
  } catch (err) {
    console.error('Git 로그를 불러오는 중 오류가 발생했습니다:', err);
  }
}

main();
