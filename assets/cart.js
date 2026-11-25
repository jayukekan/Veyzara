
/* ==========================================================
   RIYAN CREATION — PREMIUM CART SYSTEM
   Shopify Dawn 16.1.0
   File: assets/cart.js

   Supports:
   - AJAX cart quantity updates
   - Product removal
   - Cart drawer synchronization
   - Free shipping and offer section refresh
   - Discount and subtotal refresh
   - Native Shopify cart events
   - Quantity validation
   - Accessible error and loading states
   - Cart notes
   ========================================================== */


/* ==========================================================
   01. CART REMOVE BUTTON
   ========================================================== */

class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();

      const cartItems =
        this.closest('cart-items') ||
        this.closest('cart-drawer-items');

      if (!cartItems) return;

      if (this.dataset.riyanRemoving === 'true') {
        return;
      }

      const index = Number(this.dataset.index);

      if (!Number.isInteger(index) || index < 1) {
        return;
      }

      this.dataset.riyanRemoving = 'true';

      cartItems.updateQuantity(
        index,
        0,
        event
      );
    });
  }
}

if (!customElements.get('cart-remove-button')) {
  customElements.define(
    'cart-remove-button',
    CartRemoveButton
  );
}


/* ==========================================================
   02. CART ITEMS
   Maintains Dawn StandardEvents compatibility
   ========================================================== */

class CartItems extends window.StandardEvents.createViewEventElement(
  HTMLElement
) {
  constructor() {
    super();

    this.lineItemStatusElement =
      document.getElementById(
        'shopping-cart-line-item-status'
      ) ||
      document.getElementById(
        'CartDrawer-LineItemStatus'
      );

    this.riyanUpdating = false;

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener(
      'change',
      debouncedOnChange.bind(this)
    );
  }

  cartUpdateUnsubscriber = undefined;

  static pendingCartDataPromise = null;


  /* ========================================================
     03. CONNECTED CALLBACK
     ======================================================== */

  connectedCallback() {
    super.connectedCallback();

    this.cartUpdateUnsubscriber = subscribe(
      PUB_SUB_EVENTS.cartUpdate,
      (event) => {
        if (event.source === 'cart-items') {
          return;
        }

        return this.onCartUpdate();
      }
    );
  }


  /* ========================================================
     04. FETCH CART DATA
     ======================================================== */

  static fetchCartData() {
    if (!CartItems.pendingCartDataPromise) {
      const pending = fetch(
        `${routes.cart_url}.json`,
        {
          credentials: 'same-origin'
        }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              'Unable to fetch cart data'
            );
          }

          return response.json();
        })
        .catch((error) => {
          console.error(
            'Riyan Cart: Cart data error',
            error
          );

          return null;
        })
        .finally(() => {
          if (
            CartItems.pendingCartDataPromise ===
            pending
          ) {
            CartItems.pendingCartDataPromise = null;
          }
        });

      CartItems.pendingCartDataPromise = pending;
    }

    return CartItems.pendingCartDataPromise;
  }


  /* ========================================================
     05. DISCONNECTED CALLBACK
     ======================================================== */

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
      this.cartUpdateUnsubscriber = undefined;
    }
  }


  /* ========================================================
     06. RESET QUANTITY INPUT
     ======================================================== */

  resetQuantityInput(id) {
    const input =
      this.querySelector(`#Quantity-${id}`) ||
      this.querySelector(
        `#Drawer-quantity-${id}`
      );

    if (!input) return;

    input.value = input.getAttribute('value');

    this.isEnterPressed = false;
  }


  /* ========================================================
     07. VALIDATION ERROR
     ======================================================== */

  setValidity(event, index, message) {
    const input = event.target;

    if (
      !input ||
      typeof input.setCustomValidity !== 'function'
    ) {
      return;
    }

    input.setCustomValidity(message);
    input.reportValidity();

    this.resetQuantityInput(index);

    if (typeof input.select === 'function') {
      input.select();
    }
  }


  /* ========================================================
     08. VALIDATE QUANTITY
     ======================================================== */

  validateQuantity(event) {
    const input = event.target;

    if (!input) return;

    const inputValue = Number(input.value);
    const index = Number(input.dataset.index);

    const minimum = Number(
      input.dataset.min || input.min || 1
    );

    const maximum = input.max
      ? Number(input.max)
      : null;

    const increment = Number(input.step || 1);

    let message = '';

    if (
      !Number.isInteger(inputValue) ||
      inputValue < 0 ||
      !Number.isInteger(index) ||
      index < 1
    ) {
      message = 'Please enter a valid quantity.';
    } else if (inputValue < minimum) {
      message = window.quickOrderListStrings
        ?.min_error
        ?.replace('[min]', minimum) ||
        `Minimum quantity is ${minimum}`;
    } else if (
      maximum !== null &&
      Number.isFinite(maximum) &&
      inputValue > maximum
    ) {
      message = window.quickOrderListStrings
        ?.max_error
        ?.replace('[max]', maximum) ||
        `Maximum quantity is ${maximum}`;
    } else if (
      increment > 0 &&
      (inputValue - minimum) % increment !== 0
    ) {
      message = window.quickOrderListStrings
        ?.step_error
        ?.replace('[step]', increment) ||
        `Quantity must follow the increment of ${increment}`;
    }

    if (message) {
      this.setValidity(
        event,
        index,
        message
      );

      return;
    }

    input.setCustomValidity('');
    input.reportValidity();

    const activeName =
      document.activeElement?.getAttribute(
        'name'
      ) || '';

    this.updateQuantity(
      index,
      inputValue,
      event,
      activeName,
      input.dataset.quantityVariantId
    );
  }


  /* ========================================================
     09. INPUT CHANGE
     ======================================================== */

  onChange(event) {
    if (
      !event.target.matches(
        'input[name="updates[]"]'
      )
    ) {
      return;
    }

    this.validateQuantity(event);
  }


  /* ========================================================
     10. CART UPDATE FROM OTHER COMPONENTS
     ======================================================== */

  async onCartUpdate() {
    try {
      if (
        this.tagName === 'CART-DRAWER-ITEMS'
      ) {
        const response = await fetch(
          `${routes.cart_url}?section_id=cart-drawer`
        );

        if (!response.ok) {
          throw new Error(
            'Cart drawer refresh failed'
          );
        }

        const responseText =
          await response.text();

        const html = new DOMParser()
          .parseFromString(
            responseText,
            'text/html'
          );

        const sourceItems =
          html.querySelector(
            'cart-drawer-items'
          );

        const targetItems =
          document.querySelector(
            'cart-drawer-items'
          );

        if (
          sourceItems &&
          targetItems
        ) {
          targetItems.replaceWith(
            sourceItems
          );
        }

        const sourceFooter =
          html.querySelector(
            '.drawer__footer'
          );

        const targetFooter =
          document.querySelector(
            'cart-drawer .drawer__footer'
          );

        if (
          sourceFooter &&
          targetFooter
        ) {
          targetFooter.replaceWith(
            sourceFooter
          );
        }

        const drawer =
          document.querySelector(
            'cart-drawer'
          );

        const isEmpty =
          html.querySelector(
            'cart-drawer'
          )?.classList.contains(
            'is-empty'
          ) || false;

        drawer?.classList.toggle(
          'is-empty',
          isEmpty
        );

        /*
          Refresh premium blocks that sit
          outside cart-drawer-items.

          Their Liquid markup is generated
          by the cart-drawer section.
        */

        if (drawer) {
          const selectors = [
            '.rc-shipping',
            '.riyan-shipping',
            '.riyan-shipping-progress',
            '.cart-shipping-progress',
            '.rc-offer',
            '.riyan-cart-offer',
            '.premium-cart-offer',
            '.rc-recommendations',
            '.riyan-recommendations',
            '.cart-recommendations',
            '.rc-trust',
            '.riyan-cart-trust',
            '.cart-trust-badges'
          ];

          selectors.forEach((selector) => {
            const oldElement =
              drawer.querySelector(selector);

            const newElement =
              html.querySelector(selector);

            if (oldElement && newElement) {
              oldElement.replaceWith(
                newElement
              );
            } else if (
              oldElement &&
              !newElement
            ) {
              oldElement.remove();
            }
          });
        }

      } else {
        const response = await fetch(
          `${routes.cart_url}?section_id=main-cart-items`
        );

        if (!response.ok) {
          throw new Error(
            'Cart page refresh failed'
          );
        }

        const responseText =
          await response.text();

        const html = new DOMParser()
          .parseFromString(
            responseText,
            'text/html'
          );

        const source =
          html.querySelector(
            'cart-items'
          );

        if (source) {
          this.innerHTML =
            source.innerHTML;
        }
      }
    } catch (error) {
      console.error(
        'Riyan Cart: Refresh error',
        error
      );
    }
  }


  /* ========================================================
     11. SHOPIFY SECTIONS TO RENDER
     ======================================================== */

  getSectionsToRender() {
    const mainItems =
      document.getElementById(
        'main-cart-items'
      );

    const mainFooter =
      document.getElementById(
        'main-cart-footer'
      );

    return [
      {
        id: 'main-cart-items',
        section:
          mainItems?.dataset.id ||
          'main-cart-items',
        selector: '.js-contents'
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section'
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section'
      },
      {
        id: 'main-cart-footer',
        section:
          mainFooter?.dataset.id ||
          'main-cart-footer',
        selector: '.js-contents'
      }
    ];
  }


  /* ========================================================
     12. UPDATE QUANTITY
     Main Shopify AJAX cart operation
     ======================================================== */

  async updateQuantity(
    line,
    quantity,
    event,
    name,
    variantId
  ) {
    if (this.riyanUpdating) {
      return;
    }

    this.riyanUpdating = true;

    const isRemove =
      event?.currentTarget instanceof
      CartRemoveButton;

    const eventTarget =
      isRemove ? 'clear' : 'change';

    const marker =
      typeof CartPerformance !== 'undefined'
        ? CartPerformance.createStartingMarker(
            `${eventTarget}:user-action`
          )
        : null;

    const quantityInput =
      this.querySelector(
        `#Quantity-${line}`
      ) ||
      this.querySelector(
        `#Drawer-quantity-${line}`
      );

    const lineVariantId =
      variantId ||
      quantityInput?.dataset.quantityVariantId;

    const lineKey =
      quantityInput?.dataset.quantityLineKey;

    const action =
      quantity === 0 ? 'remove' : 'update';

    const deferred =
      this.createCartLinesUpdateEvent(
        action,
        lineVariantId,
        quantity,
        lineKey
      );

    const sectionsToRender =
      this.getSectionsToRender();

    this.enableLoading(line);

    const body = JSON.stringify({
      line: Number(line),
      quantity: Number(quantity),
      sections: sectionsToRender.map(
        (section) => section.section
      ),
      sections_url:
        window.location.pathname
    });

    try {
      const response = await fetch(
        routes.cart_change_url,
        {
          ...fetchConfig(),
          body
        }
      );

      const responseText =
        await response.text();

      let parsedState;

      try {
        parsedState = JSON.parse(
          responseText
        );
      } catch {
        throw new Error(
          'Invalid response from Shopify cart.'
        );
      }

      if (
        !response.ok ||
        parsedState.errors
      ) {
        const errorMessage =
          parsedState.description ||
          parsedState.errors ||
          window.cartStrings?.error ||
          'Unable to update cart.';

        this.dispatchCartErrorEvent(
          errorMessage,
          'INVALID'
        );

        deferred?.reject(
          new Error(
            String(errorMessage)
          )
        );

        if (quantityInput) {
          quantityInput.value =
            quantityInput.getAttribute(
              'value'
            );
        }

        this.updateLiveRegions(
          line,
          String(errorMessage)
        );

        return;
      }

      this.resolveCartLinesUpdate(
        deferred,
        parsedState
      );

      const wasEmpty =
        parsedState.item_count === 0;

      this.classList.toggle(
        'is-empty',
        wasEmpty
      );

      const cartDrawerWrapper =
        document.querySelector(
          'cart-drawer'
        );

      const cartFooter =
        document.getElementById(
          'main-cart-footer'
        );

      cartFooter?.classList.toggle(
        'is-empty',
        wasEmpty
      );

      cartDrawerWrapper?.classList.toggle(
        'is-empty',
        wasEmpty
      );

      /*
        Update every Shopify section.

        This refreshes product quantities,
        subtotal, discounts, cart count
        and Liquid-based premium blocks.
      */

      sectionsToRender.forEach(
        (section) => {
          const newHTML =
            parsedState.sections?.[
              section.section
            ];

          if (!newHTML) return;

          const sectionContainer =
            document.getElementById(
              section.id
            );

          if (!sectionContainer) return;

          const replacement =
            sectionContainer.querySelector(
              section.selector
            ) || sectionContainer;

          const updatedHTML =
            this.getSectionInnerHTML(
              newHTML,
              section.selector
            );

          if (updatedHTML !== null) {
            replacement.innerHTML =
              updatedHTML;
          }
        }
      );

      /*
        Synchronize drawer state after
        Shopify renders new sections.
      */

      const drawer =
        document.querySelector(
          'cart-drawer'
        );

      if (drawer) {
        drawer.classList.toggle(
          'is-empty',
          wasEmpty
        );
      }

      /*
        Cart quantity error handling.
      */

      const updatedValue =
        parsedState.items?.[
          Number(line) - 1
        ]?.quantity;

      let message = '';

      if (
        quantityInput &&
        typeof updatedValue !== 'undefined' &&
        updatedValue !==
          Number(quantityInput.value)
      ) {
        message =
          window.cartStrings
            ?.quantityError
            ?.replace(
              '[quantity]',
              updatedValue
            ) || '';
      }

      this.updateLiveRegions(
        line,
        message
      );

      /*
        Restore focus to quantity controls
        after AJAX DOM replacement.
      */

      const lineItem =
        document.getElementById(
          `CartItem-${line}`
        ) ||
        document.getElementById(
          `CartDrawer-Item-${line}`
        );

      const focusTarget =
        lineItem && name
          ? [...lineItem.querySelectorAll(
              '[name]'
            )].find(
              (element) =>
                element.getAttribute(
                  'name'
                ) === name
            )
          : null;

      if (
        focusTarget &&
        typeof trapFocus === 'function' &&
        cartDrawerWrapper?.classList.contains(
          'active'
        )
      ) {
        trapFocus(
          cartDrawerWrapper,
          focusTarget
        );
      } else if (focusTarget) {
        focusTarget.focus();
      } else if (
        wasEmpty &&
        cartDrawerWrapper
      ) {
        const emptyContainer =
          cartDrawerWrapper.querySelector(
            '.drawer__inner-empty'
          );

        const emptyLink =
          emptyContainer?.querySelector(
            'a'
          );

        if (
          emptyContainer &&
          emptyLink &&
          typeof trapFocus === 'function'
        ) {
          trapFocus(
            emptyContainer,
            emptyLink
          );
        }
      }

      publish(
        PUB_SUB_EVENTS.cartUpdate,
        {
          source: 'cart-items',
          cartData: parsedState,
          variantId:
            lineVariantId || variantId
        }
      );

      /*
        Optional custom event for premium
        cart interface integrations.
      */

      this.dispatchEvent(
        new CustomEvent(
          'riyan:cart-updated',
          {
            bubbles: true,
            detail: {
              itemCount:
                parsedState.item_count,
              totalPrice:
                parsedState.total_price,
              cart: parsedState
            }
          }
        )
      );

    } catch (error) {
      console.error(
        'Riyan Cart: Update failed',
        error
      );

      const errorMessage =
        window.cartStrings?.error ||
        'Unable to update your cart. Please try again.';

      const errors =
        document.getElementById(
          'cart-errors'
        ) ||
        document.getElementById(
          'CartDrawer-CartErrors'
        );

      if (errors) {
        errors.textContent =
          errorMessage;
      }

      if (quantityInput?.isConnected) {
        quantityInput.value =
          quantityInput.getAttribute(
            'value'
          );
      }

      this.dispatchCartErrorEvent(
        errorMessage,
        'SERVICE_UNAVAILABLE'
      );

      deferred?.reject(error);

    } finally {
      this.disableLoading(line);

      this.riyanUpdating = false;

      this.querySelectorAll(
        'cart-remove-button'
      ).forEach((button) => {
        delete button.dataset.riyanRemoving;
      });

      if (
        marker &&
        typeof CartPerformance !== 'undefined'
      ) {
        CartPerformance.measureFromMarker(
          `${eventTarget}:user-action`,
          marker
        );
      }
    }
  }


  /* ========================================================
     13. CART LINE UPDATE EVENTS
     ======================================================== */

  createCartLinesUpdateEvent(
    action,
    variantId,
    quantity,
    lineKey
  ) {
    const {
      CartLinesUpdateEvent
    } = window.StandardEvents || {};

    if (
      !CartLinesUpdateEvent ||
      !variantId ||
      !lineKey
    ) {
      return null;
    }

    const deferred =
      CartLinesUpdateEvent.createPromise();

    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action,
        context: 'cart',
        lines: [
          {
            id: lineKey,
            quantity
          }
        ],
        promise: deferred.promise
      })
    );

    return deferred;
  }


  /* ========================================================
     14. RESOLVE CART LINE UPDATE
     ======================================================== */

  resolveCartLinesUpdate(
    deferred,
    parsedState
  ) {
    if (!deferred) return;

    const {
      CartLinesUpdateEvent
    } = window.StandardEvents || {};

    if (!CartLinesUpdateEvent) return;

    deferred.resolve({
      cart:
        CartLinesUpdateEvent
          .createCartFromAjaxResponse(
            parsedState
          )
    });
  }


  /* ========================================================
     15. DISPATCH CART ERROR
     ======================================================== */

  dispatchCartErrorEvent(
    message,
    code
  ) {
    const {
      CartErrorEvent
    } = window.StandardEvents || {};

    if (!CartErrorEvent) return;

    this.dispatchEvent(
      new CartErrorEvent({
        error: message,
        code
      })
    );
  }


  /* ========================================================
     16. ACCESSIBLE STATUS MESSAGES
     ======================================================== */

  updateLiveRegions(
    line,
    message
  ) {
    const lineItemError =
      document.getElementById(
        `Line-item-error-${line}`
      ) ||
      document.getElementById(
        `CartDrawer-LineItemError-${line}`
      );

    const errorText =
      lineItemError?.querySelector(
        '.cart-item__error-text'
      );

    if (errorText) {
      errorText.textContent =
        message || '';
    }

    const lineStatus =
      document.getElementById(
        'shopping-cart-line-item-status'
      ) ||
      document.getElementById(
        'CartDrawer-LineItemStatus'
      );

    lineStatus?.setAttribute(
      'aria-hidden',
      'true'
    );

    const cartStatus =
      document.getElementById(
        'cart-live-region-text'
      ) ||
      document.getElementById(
        'CartDrawer-LiveRegionText'
      );

    if (!cartStatus) return;

    cartStatus.setAttribute(
      'aria-hidden',
      'false'
    );

    setTimeout(() => {
      if (cartStatus.isConnected) {
        cartStatus.setAttribute(
          'aria-hidden',
          'true'
        );
      }
    }, 1000);
  }


  /* ========================================================
     17. EXTRACT SHOPIFY SECTION HTML
     ======================================================== */

  getSectionInnerHTML(
    html,
    selector
  ) {
    if (typeof html !== 'string') {
      return null;
    }

    const parsedDocument =
      new DOMParser().parseFromString(
        html,
        'text/html'
      );

    const target =
      parsedDocument.querySelector(
        selector
      );

    return target
      ? target.innerHTML
      : null;
  }


  /* ========================================================
     18. ENABLE LOADING STATE
     ======================================================== */

  enableLoading(line) {
    const cartItems =
      document.getElementById(
        'main-cart-items'
      ) ||
      document.getElementById(
        'CartDrawer-CartItems'
      );

    cartItems?.classList.add(
      'cart__items--disabled'
    );

    const loadingElements =
      this.querySelectorAll(
        `#CartItem-${line} .loading__spinner, ` +
        `#CartDrawer-Item-${line} .loading__spinner`
      );

    loadingElements.forEach(
      (spinner) => {
        spinner.classList.remove(
          'hidden'
        );
      }
    );

    const status =
      document.getElementById(
        'shopping-cart-line-item-status'
      ) ||
      document.getElementById(
        'CartDrawer-LineItemStatus'
      );

    status?.setAttribute(
      'aria-hidden',
      'false'
    );
  }


  /* ========================================================
     19. DISABLE LOADING STATE
     ======================================================== */

  disableLoading(line) {
    const cartItems =
      document.getElementById(
        'main-cart-items'
      ) ||
      document.getElementById(
        'CartDrawer-CartItems'
      );

    cartItems?.classList.remove(
      'cart__items--disabled'
    );

    const loadingElements =
      this.querySelectorAll(
        `#CartItem-${line} .loading__spinner, ` +
        `#CartDrawer-Item-${line} .loading__spinner`
      );

    loadingElements.forEach(
      (spinner) => {
        spinner.classList.add(
          'hidden'
        );
      }
    );
  }
}


/* ==========================================================
   20. REGISTER CART ITEMS
   ========================================================== */

if (!customElements.get('cart-items')) {
  customElements.define(
    'cart-items',
    CartItems
  );
}


/* ==========================================================
   21. CART NOTE
   Preserves Shopify Dawn StandardEvents
   ========================================================== */

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const newNote =
              event.target.value;

            const noteDeferred =
              this.dispatchNoteUpdateEvent(
                newNote
              );

            const body =
              JSON.stringify({
                note: newNote
              });

            fetch(
              routes.cart_update_url,
              {
                ...fetchConfig(),
                body
              }
            )
              .then((response) => {
                if (!response.ok) {
                  throw new Error(
                    'Cart note update failed.'
                  );
                }

                return response.json();
              })
              .then((cart) => {
                if (
                  !cart ||
                  cart.errors
                ) {
                  throw Object.assign(
                    new Error(
                      cart?.errors ||
                      'Invalid cart note.'
                    ),
                    {
                      code: 'INVALID'
                    }
                  );
                }

                if (noteDeferred) {
                  const {
                    CartNoteUpdateEvent
                  } = window.StandardEvents || {};

                  if (
                    CartNoteUpdateEvent
                  ) {
                    noteDeferred.resolve({
                      cart:
                        CartNoteUpdateEvent
                          .createCartFromAjaxResponse(
                            cart
                          )
                    });
                  }
                }

                if (
                  typeof CartPerformance !==
                  'undefined'
                ) {
                  CartPerformance.measureFromEvent(
                    'note-update:user-action',
                    event
                  );
                }
              })
              .catch((error) => {
                noteDeferred?.reject(
                  error
                );

                const {
                  CartErrorEvent
                } = window.StandardEvents || {};

                if (
                  CartErrorEvent
                ) {
                  this.dispatchEvent(
                    new CartErrorEvent({
                      error:
                        error.message ||
                        'Note update failed',
                      code:
                        error.code ||
                        'SERVICE_UNAVAILABLE'
                    })
                  );
                }
              });

          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }

      dispatchNoteUpdateEvent(
        newNote
      ) {
        const {
          CartNoteUpdateEvent
        } = window.StandardEvents || {};

        if (!CartNoteUpdateEvent) {
          return null;
        }

        const context =
          this.closest('dialog') ||
          this.closest('cart-drawer')
            ? 'dialog'
            : 'cart';

        const deferred =
          CartNoteUpdateEvent
            .createPromise();

        this.dispatchEvent(
          new CartNoteUpdateEvent({
            context,
            note: newNote,
            promise:
              deferred.promise
          })
        );

        return deferred;
      }
    }
  );
}

/* ==========================================================
   END — RIYAN CREATION PREMIUM CART.JS
   ========================================================== */









   
/* =====================================================
   RIYAN CREATION — REMOVE ITEM AT QUANTITY 1

   When minus is clicked at quantity 1:
   - Sends quantity 0 to Shopify
   - Removes product from cart
   - Refreshes cart through existing CartItems logic
   - Preserves minimum purchase rules for quantities > 0
   ===================================================== */

(function () {
  'use strict';

  if (window.RiyanCartZeroRemoveInstalled) return;

  window.RiyanCartZeroRemoveInstalled = true;

  document.addEventListener(
    'click',
    function (event) {
      const minusButton = event.target.closest(
        'cart-drawer-items quantity-input .quantity__button[name="minus"], ' +
        'cart-items quantity-input .quantity__button[name="minus"]'
      );

      if (!minusButton) return;

      const quantityControl = minusButton.closest(
        'quantity-input'
      );

      const input = quantityControl?.querySelector(
        'input[name="updates[]"]'
      );

      if (!input) return;

      const currentQuantity = Number(input.value);

      if (currentQuantity !== 1) return;

      if (input.disabled) return;

      const cartItems =
        minusButton.closest('cart-drawer-items') ||
        minusButton.closest('cart-items');

      if (
        !cartItems ||
        typeof cartItems.updateQuantity !== 'function'
      ) {
        return;
      }

      const cartRow = minusButton.closest('.cart-item');

      const removeButton = cartRow?.querySelector(
        'cart-remove-button button'
      );

      if (
        removeButton &&
        removeButton.hasAttribute('disabled')
      ) {
        return;
      }

      const line = Number(input.dataset.index);

      if (!Number.isInteger(line) || line < 1) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (cartItems.riyanUpdating) return;

      cartItems.updateQuantity(
        line,
        0,
        event,
        'minus',
        input.dataset.quantityVariantId
      );
    },
    true
  );
})();
