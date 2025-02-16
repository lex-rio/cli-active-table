import { list, list2 } from './test-data.json';
import { ActiveTable } from '../src/active-table';

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
      data: list2,
      fields: ['title', 'id'],
      title: 'list2',
    },
  ]).handle();

  console.log(result);
};

run().catch(console.error).finally(terminate);

async function terminate() {
  console.log('termination...');
  process.exit(0);
}
