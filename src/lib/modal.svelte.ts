export type ModalType = 'alert' | 'confirm' | 'prompt';

export interface ModalOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type: ModalType;
  resolve: (value: any) => void;
}

class ModalStore {
  #state = $state<ModalOptions | null>(null);

  get current() {
    return this.#state;
  }

  alert(message: string, title = 'Alert') {
    return new Promise((resolve) => {
      this.#state = {
        type: 'alert',
        message,
        title,
        confirmText: 'OK',
        resolve
      };
    });
  }

  confirm(message: string, title = 'Confirm') {
    return new Promise((resolve) => {
      this.#state = {
        type: 'confirm',
        message,
        title,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        resolve
      };
    });
  }

  close(value: any = null) {
    if (this.#state) {
      this.#state.resolve(value);
    }
    this.#state = null;
  }
}

export const modal = new ModalStore();
