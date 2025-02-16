[Back](../../README.md)

### Basic example

```typescript
const data = [
  { id: 1, name: 'name1', description: 'description1' },
  { id: 2, name: 'name2', description: 'description2' },
  { id: 3, name: 'name3', description: 'description3' },
];

const table = new ActiveTable([{ data }]);
const result = await table.handle();
console.log(result);
```
