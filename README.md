# cli-active-table

A lightweight JavaScript utility for rendering data in command line interface.

## Installation

To install the package, use the following command:

`TBD`

## Usage

### Basic usage

```typescript
await new ActiveTable([
  {
    data: list,
    fields: ['name', 'description'],
    title: 'list3',
  },
]).handle();
```

![Screenshot 1](./assets/screenshot_1.png)

### Validation

```typescript
const result = await new ActiveTable([
  {
    data: list,
    fields: ['name', 'description'],
    title: 'list',
    validate: (list, error) => {
      if (list.length > 0) {
        return true;
      }
      error.message = 'choose at least one';
      return false;
    },
  },
]).handle();
console.log(result);
```

![Screenshot 2](./assets/screenshot_2.png)

### Multiple tables

```typescript
const result = await new ActiveTable([
  {
    data: list,
    fields: ['name', 'description'],
    title: 'list',
  },
  {
    data: list,
    fields: ['name'],
    title: 'list3',
  },
  {
    data: list2,
    fields: ['title', 'description'],
    title: 'title 5',
  },
]).handle();
```

![Screenshot 3](./assets/screenshot_3.png)

## Key bindings

| Component    | Key         | Description         |
| ------------ | ----------- | ------------------- |
| Any          | `Ctrl+C`    | Exit application    |
| Any          | `Tab`       | Rotate section      |
| Any          | `Shift+Tab` | Back rotate section |
| List Section | `Space`     | Select/Deselect row |
| List Section | `Ctrl+a`    | Select/Deselect all |
| List Section | `delete`    | Delete row          |
| List Section | `Ctrl+f`    | Enable search mode  |

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix: `git checkout -b feature-name`
3. Commit your changes: `git commit -m "Description of changes"`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request.

License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
