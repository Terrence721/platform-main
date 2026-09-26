import { withHooks } from '../src';
import { getInitialInnerStore } from '../src/signal-store';

describe('withHooks', () => {
  it('adds onInit hook to the store', () => {
    const initialStore = getInitialInnerStore();
    let message = '';

    const store = withHooks({
      onInit() {
        message = 'onInit';
      },
    })(initialStore);
    store.hooks.onInit?.();

    expect(message).toBe('onInit');
  });

  it('executes new onInit hook after previously defined one', () => {
    const messages: string[] = [];
    const initialStore = withHooks({
      onInit() {
        messages.push('onInit1');
      },
    })(getInitialInnerStore());

    const store = withHooks({
      onInit() {
        messages.push('onInit2');
      },
    })(initialStore);
    store.hooks.onInit?.();

    expect(messages).toEqual(['onInit1', 'onInit2']);
  });

  it('adds onDestroy hook to the store', () => {
    const initialStore = getInitialInnerStore();
    let message = '';

    const store = withHooks({
      onDestroy() {
        message = 'onDestroy';
      },
    })(initialStore);
    store.hooks.onDestroy?.();

    expect(message).toBe('onDestroy');
  });

  it('executes new onDestroy hook after previously defined one', () => {
    const messages: string[] = [];
    const initialStore = withHooks({
      onDestroy() {
        messages.push('onDestroy1');
      },
    })(getInitialInnerStore());

    const store = withHooks({
      onDestroy() {
        messages.push('onDestroy2');
      },
    })(initialStore);
    store.hooks.onDestroy?.();

    expect(messages).toEqual(['onDestroy1', 'onDestroy2']);
  });

  describe('this in hooks written as methods', () => {
    class LifecycleHooks {
      readonly messages: string[] = [];
      readonly prefix = 'hooks';

      onInit(): void {
        this.messages.push(`${this.prefix}:onInit`);
      }

      onDestroy(): void {
        this.messages.push(`${this.prefix}:onDestroy`);
      }
    }

    it('calls the hooks of a hooks object as its methods', () => {
      const hooks = new LifecycleHooks();

      const store = withHooks(hooks)(getInitialInnerStore());
      store.hooks.onInit?.();
      store.hooks.onDestroy?.();

      expect(hooks.messages).toEqual(['hooks:onInit', 'hooks:onDestroy']);
    });

    it('calls the hooks of a hooks factory result as its methods', () => {
      const hooks = new LifecycleHooks();

      const store = withHooks(() => hooks)(getInitialInnerStore());
      store.hooks.onInit?.();
      store.hooks.onDestroy?.();

      expect(hooks.messages).toEqual(['hooks:onInit', 'hooks:onDestroy']);
    });

    it('refers to the hooks object in an object literal method', () => {
      const receivers: unknown[] = [];
      const hooks = {
        onInit() {
          receivers.push(this);
        },
      };

      withHooks(hooks)(getInitialInnerStore()).hooks.onInit?.();

      expect(receivers).toHaveLength(1);
      expect(receivers[0]).toBe(hooks);
    });
  });
});
