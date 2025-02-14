import { ActiveTable } from '../src/active-table';
import { scripts } from '../package.json';

const run = async () => {
  console.log(
    await new ActiveTable([
      {
        data: Object.entries(scripts)
          .map(([name, command]) => ({ name, command }))
          .filter(({ name }) => name.startsWith('examples:')),
        title: 'examples',
      },
    ]).handle()
  );
};

run().catch(console.error).finally(terminate);

async function terminate() {
  console.log('termination...');
  process.exit(0);
}
