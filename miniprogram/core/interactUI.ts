import { ChoicesUI } from '../ui/choicesUI';
import { SubUI } from './subUI';

export abstract class InteractUI<D> extends SubUI<D> {
  protected choices?: ChoicesUI;

  public getChoices(): ChoicesUI {
    if (!this.choices) {
      this.choices = new ChoicesUI(this.component);
    }
    return this.choices;
  }
}
