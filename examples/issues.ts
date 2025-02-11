import { ActiveTable } from '../src/active-table';

const url = 'https://api.github.com/repos/lex-rio/cli-active-table/issues?state=all';

const run = async () => {
  const response = await fetch(url);
  if (response.status !== 200) {
    return void console.log(await response.json());
  }
  console.log(
    await new ActiveTable([
      {
        data: await response.json(),
        fields: ['number', 'title', 'state'],
        sortBy: [{ key: 'state', direction: 'DESC' }, { key: 'number' }],
        title: 'issues',
      },
    ]).handle()
  );
};

run().catch(console.error).finally(terminate);

async function terminate() {
  console.log('termination...');
  process.exit(0);
}
