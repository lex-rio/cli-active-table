import { list, list2 } from './../test-data.json';
import { ActiveTable } from './active-table';

const run = async () => {
  await new ActiveTable(
    {
      data: list,
      primary: 'id',
      fields: ['name', 'description'],
      title: 'list',
    },
    {
      data: list2,
      primary: 'id',
      fields: ['title', 'description'],
      title: 'list2',
    }
  ).handle();
};

run().catch(console.error).finally(terminate);

async function terminate() {
  console.log('termination...');
  process.exit(0);
}
