import { list, list2 } from './../test-data.json';
import { ActiveTable } from './active-table';

const run = async () => {
  const result = await new ActiveTable([
    {
      data: list,
      primary: 'id',
      //   fields: ['name', 'description'],
      title: 'list',
      validate: (list, error) => {
        if (list.length > 0) {
          return true;
        }
        error.message = 'choose at least one';
        return false;
      },
    },
    {
      data: list,
      primary: 'id',
      fields: ['name'],
      title: 'list3',
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
      title: 'section #4',
    },
  ]).handle();

  console.log(result);
};

run().catch(console.error).finally(terminate);

async function terminate() {
  console.log('termination...');
  process.exit(0);
}
