import { ActiveTable } from '../src/active-table';

const url = 'https://openlibrary.org/search.json?q=1984';

const run = async () => {
  const response = await fetch(url);
  const data = (await response.json()).docs;
  console.log(
    await new ActiveTable([
      {
        data,
        fields: ['title', 'first_publish_year'],
        title: 'books',
      },
    ]).handle()
  );
};

run().catch(console.error).finally(terminate);

async function terminate() {
  console.log('termination...');
  process.exit(0);
}
