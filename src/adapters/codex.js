import { join } from 'node:path';
import { homedir } from 'node:os';
import { BaseAdapter } from './base.js';

export class CodexAdapter extends BaseAdapter {
  get toolName() { return 'codex'; }

  getUserDir() { return join(homedir(), '.codex'); }

  getSkillsDir() { return join(this.getUserDir(), 'skills'); }
}
