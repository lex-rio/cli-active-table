![npm](https://img.shields.io/npm/v/cli-active-table)
![license](https://img.shields.io/github/license/lex-rio/cli-active-table)
![downloads](https://img.shields.io/npm/dt/cli-active-table)

# cli-active-table

Is an npm package for Node.js CLI applications that provides interactive tables with keyboard navigation, preview, and support for rendering multiple lists.

## Installation

To install the package, use the one of the following commands depending on you package manager:

```sh
npm install cli-active-table
```

```sh
yarn add cli-active-table
```

```sh
pnpm add cli-active-table
```

## Usage

### Basic usage

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

![Screenshot 1](./assets/basic.png)

### More examples

[Multiple tables](./docs/examples/multiple.md)

[Validation](./docs/examples/validation.md)

[Sorting](./docs/examples/sorting.md)

[Search](./docs/examples/search.md)

### Use Сases

#### Gilhub issues

```sh
npm run examples:issues
```

#### multiple table on one screen

```sh
npm run examples:multiple
```

#### crypto currencies data from api.coingecko.com

```sh
npm run examples:crypto
```

### books list from openlibrary.org

```sh
npm run examples:books
```

#### space launches data from api.spacexdata.com

```sh
npm run examples:launches
```

## Key bindings

| Component       | Key         | Description           |
| --------------- | ----------- | --------------------- |
| Any             | `Ctrl+C`    | Exit application      |
| List Section    | `Tab`       | Rotate section        |
| List Section    | `Shift+Tab` | Back rotate section   |
| List Section    | `Escape`    | Return selected data  |
| List Section    | `Enter`     | Open Preview section  |
| List Section    | `Space`     | Select/Deselect row   |
| List Section    | `Ctrl+a`    | Select/Deselect all   |
| List Section    | `delete`    | Delete row            |
| List Section    | `Ctrl+f`    | Enable search mode    |
| Preview Section | `Escape`    | Close Preview section |
| Preview Section | `Enter`     | Close Preview section |

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix: `git checkout -b feature-name`
3. Commit your changes: `git commit -m "Description of changes"`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request.

License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
