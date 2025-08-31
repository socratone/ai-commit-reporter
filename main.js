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
      name: 'commitHash',
      message: '조회할 커밋 해시를 입력하세요 (7~40자):',
      validate(input) {
        // 일반적인 git 해시 형태(축약 포함) 여부만 간단 검증
        const regex = /^[0-9a-f]{7,40}$/i;
        if (!regex.test(input.trim())) return '유효한 커밋 해시를 입력하세요.';
        return true;
      },
    },
  ]);

  const git = simpleGit(answers.gitPath);

  try {
    // 단일 커밋 해시에 대한 상세 정보와 변경 요약을 출력한다.
    // --quiet: diff 앞에 불필요한 로그 최소화
    // --pretty=fuller: 작성자/커미터와 날짜 등 메타데이터를 상세히 출력
    // --stat: 파일 변경 요약(추가/삭제 라인, 파일 목록) 출력
    console.log('\n==== 입력한 정보 ====');
    console.log(`경로: ${answers.gitPath}`);
    console.log(`커밋 해시: ${answers.commitHash}`);

    console.log('\n==== 커밋 상세 ====');
    const showResult = await git.show([
      '--quiet',
      '--pretty=fuller',
      '--patch',
      '--stat',
      answers.commitHash,
    ]);
    console.log(showResult);

    const result = await generateMessage(
      '아래 커밋 메시지와 변경사항을 분석해서 무엇을 했는지 설명해줘:' +
        '\n\n' +
        showResult
    );
    console.log(result);

    // show 결과를 텍스트 파일로 저장한다.
    // - 파일명: commit-show-<hash>.txt
    // - 저장 위치: 사용자가 입력한 저장소 경로(answers.gitPath)
    const sanitizedHash = answers.commitHash.trim();
    const fileName = `commit-show-${sanitizedHash}.txt`;
    const outPath = path.join(answers.gitPath, fileName);

    try {
      // 동기 저장: 결과가 확실히 기록되도록 함. 파일 크기가 아주 클 경우 비동기(fs.promises.writeFile) 사용 고려 가능
      fs.writeFileSync(outPath, showResult + '\n\n' + result, 'utf8');
      console.log(
        `\n[저장 완료] git show 결과가 파일로 저장되었습니다: ${outPath}`
      );
    } catch (fileErr) {
      // 파일 시스템 권한/경로 문제 등 저장 실패 시 사용자에게 안내
      console.error('git show 결과 파일 저장 중 오류가 발생했습니다:', fileErr);
    }
  } catch (err) {
    console.error('Git 로그를 불러오는 중 오류가 발생했습니다:', err);
  }
}

main();
