import { list } from './../test-data.json';
import { ActiveTable } from './active-table';

const run = async () => {
  await new ActiveTable([
    {
      data: list,
      primary: 'id',
      title: 'some title',
    },
  ]).handle();
};

run().catch(console.error).finally(terminate);

async function terminate() {
  console.log('termination...');
  process.exit(0);
}
