import chalk from 'chalk';

export class MfaDisplay {
  private readonly shown = new Set<string>();

  showNumber(number: string): void {
    if (!number || this.shown.has(number)) return;
    this.shown.add(number);
    const highlighted = chalk.inverse(` ${number} `);
    const line = '  MFA  Tap this number in your Authenticator app: ' + highlighted + '  ';
    console.log('');
    console.log(chalk.bold.bgYellow.black(line));
    console.log(chalk.gray('  (waiting for your approval…)'));
    console.log('');
  }

  showApprove(): void {
    if (this.shown.has('approve')) return;
    this.shown.add('approve');
    console.log('');
    console.log(chalk.bold.bgYellow.black('  MFA  Open Microsoft Authenticator and tap APPROVE  '));
    console.log(chalk.gray('  (waiting for your approval on the phone…)'));
    console.log('');
  }
}
