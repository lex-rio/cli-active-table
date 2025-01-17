const colors = {
  default: '39',
  black: '30',
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
  magenta: '35',
  cyan: '36',
  grey: '90',
};

const bgColors = {
  default: '49',
  white: '47',
  yellow: '48;5;226',
  dark: '48;5;238',
  grey: '48;5;246',
  blue: '48;5;39',
};

const styles = {
  normal: 0,
  bold: '1',
  underscore: '4',
  inverted: '7',
};

const ANSI_RESET = '\x1b[0m';

export const chalk = (
  str: string | number,
  options:
    | {
        color?: keyof typeof colors;
        bgColor?: keyof typeof bgColors;
        style?: keyof typeof styles;
      }
    | keyof typeof colors = {}
) => {
  const {
    color = 'default',
    bgColor = 'default',
    style = 'normal',
  } = typeof options === 'string' ? { color: options } : options;

  str = typeof str !== 'string' ? str.toString() : str;
  const codes = [styles[style], colors[color], bgColors[bgColor]];
  const code = `\x1b[${codes.filter((code) => code).join(';')}m`;
  return str.includes(ANSI_RESET)
    ? str.replace(
        /^(.*?)(?=\x1b\[)|\x1b\[0m(.*?)(?=\x1b\[\d+m)|\x1b\[0m(.*)$/g,
        (match) => `${code}${match.replace(ANSI_RESET, '')}${ANSI_RESET}`
      )
    : `${code}${str}${ANSI_RESET}`;
};
