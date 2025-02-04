import { list, list2 } from './test-data.json';
import { ActiveTable } from './src/active-table';

const run = async () => {
  const result = await new ActiveTable([
    {
      data: list,
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
      fields: ['name'],
      title: 'list3',
      height: 14,
    },
    {
      data: list2,
      fields: ['title', 'description'],
      title:
        'very long title 1 very long title 2 very long title 3 very long title 4 very long title 5',
    },
    {
      data: list2,
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
