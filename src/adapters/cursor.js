import { join } from 'node:path';
import { homedir } from 'node:os';
import { BaseAdapter } from './base.js';

export class CursorAdapter extends BaseAdapter {
  get toolName() { return 'cursor'; }

  getUserDir() { return join(homedir(), '.cursor'); }

  getSkillsDir() { return join(this.getUserDir(), 'skills'); }

  getCommandsDir() { return join(this.getUserDir(), 'commands'); }
}
