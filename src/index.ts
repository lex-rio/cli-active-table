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
      data: list,
      primary: 'id',
      fields: ['name'],
      title: 'list',
      lines: 10,
    },
    {
      data: list2,
      primary: 'id',
      fields: ['title', 'description'],
      title:
        'very long title 1 very long title 2 very long title 3 very long title 4 very long title 5',
    },
    {
      data: list2,
      primary: 'id',
      fields: ['title', 'description'],
      title:
        'very long title 1 very long title 2 very long title 3 very long title 4 very long title 5',
    }
  ).handle();
};

run().catch(console.error).finally(terminate);

async function terminate() {
  console.log('termination...');
  process.exit(0);
}
