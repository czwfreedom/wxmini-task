import { ChoicesUI } from '../ui/choicesUI';
import { DialogUI } from '../ui/dialogUI';
import { SubUI } from './subUI';

export abstract class InteractUI<D> extends SubUI<D> {
  protected choices?: ChoicesUI;

  protected dialog?: DialogUI;

  public getDialog(): DialogUI {
    if (!this.dialog) this.dialog = new DialogUI(this.component, this.subDataKey);
    return this.dialog;
  }

  public getChoices(): ChoicesUI {
    if (!this.choices) {
      this.choices = new ChoicesUI(this.component);
    }
    return this.choices;
  }
}
