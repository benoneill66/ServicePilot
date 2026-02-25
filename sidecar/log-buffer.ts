const MAX_LINES = 2000;

export class LogBuffer {
  private lines: string[] = [];

  push(text: string) {
    const newLines = text.split("\n");
    this.lines.push(...newLines);
    if (this.lines.length > MAX_LINES) {
      this.lines = this.lines.slice(-MAX_LINES);
    }
  }

  getLines(): string[] {
    return this.lines;
  }

  clear() {
    this.lines = [];
  }
}
