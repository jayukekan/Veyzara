
/* =========================================================
   RIYAN CREATION — PREMIUM CART DRAWER
   Shopify Dawn 16.1.0
   File: assets/cart-drawer.js

   Preserves Dawn's existing CartDrawer and CartItems
   architecture while adding AJAX product recommendations.

   Recommendation button format:

   <button
     type="button"
     data-riyan-add
     data-variant-id="123456789"
     data-quantity="1"
   >
     Add to Bag
   </button>

   Important:
   Recommended products requiring variant selection
   should link to their product pages unless a specific
   valid variant has been selected.
   ========================================================= */

class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.activeElement = null;
    this.productId = null;
    this.riyanAddingProduct = false;
    this.riyanRefreshPromise = null;
    this.riyanClosing = false;

    this.onDrawerKeyup = this.onDrawerKeyup.bind(this);
    this.onOverlayClick = this.onOverlayClick.bind(this);
    this.onPremiumCartClick = this.onPremiumCartClick.bind(this);
    this.onCartIconClick = this.onCartIconClick.bind(this);
    this.onCartIconKeydown = this.onCartIconKeydown.bind(this);

    this.addEventListener('keyup', this.onDrawerKeyup);
    this.addEventListener('click', this.onPremiumCartClick);
    document.addEventListener('click', this.onCartIconClick);
    document.addEventListener('keydown', this.onCartIconKeydown);

    this.querySelector('#CartDrawer-Overlay')
      ?.addEventListener('click', this.onOverlayClick);

    this.setHeaderCartIconAccessibility();
    this.setupPremiumAccessibility();
  }

  /* -----------------------------------------------------
     KEYBOARD ACCESSIBILITY
     ----------------------------------------------------- */

  onDrawerKeyup(event) {
    if (event.code === 'Escape' || event.key === 'Escape') {
      this.close();
    }
  }

  onOverlayClick() {
    this.close();
  }

  setupPremiumAccessibility() {
    const inner = this.querySelector('.drawer__inner');

    if (!inner) return;

    inner.setAttribute('role', 'dialog');
    inner.setAttribute('aria-modal', 'true');

    const heading = inner.querySelector('.drawer__heading');

    if (heading) {
      if (!heading.id) {
        heading.id = 'RiyanCartDrawerHeading';
      }

      inner.setAttribute('aria-labelledby', heading.id);
    }
  }

  /* -----------------------------------------------------
     HEADER CART ICON
     ----------------------------------------------------- */

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');

    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
  }

  onCartIconClick(event) {
    const cartLink = event.target.closest?.('#cart-icon-bubble');

    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');

    const drawer = document.querySelector('cart-drawer');

    if (!drawer || typeof drawer.open !== 'function') return;

    event.preventDefault();
    drawer.open(cartLink);
  }

  onCartIconKeydown(event) {
    if (
      event.code !== 'Space' &&
      event.code !== 'Spacebar' &&
      event.key !== ' '
    ) {
      return;
    }

    const cartLink = event.target.closest?.('#cart-icon-bubble');

    if (!cartLink) return;

    const drawer = document.querySelector('cart-drawer');

    if (!drawer || typeof drawer.open !== 'function') return;

    event.preventDefault();
    drawer.open(cartLink);
  }

  /* -----------------------------------------------------
     OPEN CART DRAWER
     ----------------------------------------------------- */

  open(triggeredBy) {
    if (this.classList.contains('active')) {
      return;
    }

    if (triggeredBy) {
      this.setActiveElement(triggeredBy);
    }

    this.riyanClosing = false;

    const cartDrawerNote = this.querySelector(
      '[id^="Details-"] summary'
    );

    if (
      cartDrawerNote &&
      !cartDrawerNote.hasAttribute('role')
    ) {
      this.setSummaryAccessibility(cartDrawerNote);
    }

    this.setupPremiumAccessibility();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.riyanClosing) return;

        this.classList.add('animate', 'active');
      });
    });

    document.body.classList.add('overflow-hidden');

    this.addEventListener(
      'transitionend',
      (event) => {
        if (event.target !== this.querySelector('.drawer__inner')) {
          return;
        }

        if (!this.classList.contains('active')) {
          return;
        }

        this.focusDrawer();
      },
      { once: true }
    );

    const drawerItems = this.querySelector(
      'cart-drawer-items'
    );

    if (
      drawerItems &&
      typeof drawerItems.dispatchViewEvent === 'function'
    ) {
      drawerItems.dispatchViewEvent();
    }
  }

  focusDrawer() {
    if (!this.classList.contains('active')) {
      return;
    }

    const focusContainer = this.classList.contains('is-empty')
      ? this.querySelector('.drawer__inner-empty')
      : this.querySelector('.drawer__inner');

    const focusElement = this.querySelector('.drawer__close');

    if (
      focusContainer &&
      focusElement &&
      typeof trapFocus === 'function'
    ) {
      trapFocus(focusContainer, focusElement);
    }
  }

  /* -----------------------------------------------------
     CLOSE CART DRAWER
     ----------------------------------------------------- */

  close() {
    if (!this.classList.contains('active')) {
      return;
    }

    this.riyanClosing = true;

    this.classList.remove('active', 'animate');

    if (typeof removeTrapFocus === 'function') {
      removeTrapFocus(this.activeElement);
    }

    document.body.classList.remove('overflow-hidden');
  }

  /* -----------------------------------------------------
     CART NOTE ACCESSIBILITY
     ----------------------------------------------------- */

  setSummaryAccessibility(cartDrawerNote) {
    if (!cartDrawerNote) return;

    cartDrawerNote.setAttribute('role', 'button');

    const details = cartDrawerNote.closest('details');

    cartDrawerNote.setAttribute(
      'aria-expanded',
      details?.hasAttribute('open') ? 'true' : 'false'
    );

    if (
      cartDrawerNote.nextElementSibling &&
      cartDrawerNote.nextElementSibling.id
    ) {
      cartDrawerNote.setAttribute(
        'aria-controls',
        cartDrawerNote.nextElementSibling.id
      );
    }

    if (cartDrawerNote.dataset.riyanBound === 'true') {
      return;
    }

    cartDrawerNote.dataset.riyanBound = 'true';

    cartDrawerNote.addEventListener('click', () => {
      cartDrawerNote.setAttribute(
        'aria-expanded',
        !details.hasAttribute('open')
      );
    });

    if (
      details &&
      typeof onKeyUpEscape === 'function'
    ) {
      details.addEventListener(
        'keyup',
        onKeyUpEscape
      );
    }
  }

  /* -----------------------------------------------------
     SHOPIFY CART ROUTES
     ----------------------------------------------------- */

  getCartRoute(routeName, fallback) {
    const configured = window.routes?.[routeName];

    if (configured) {
      return configured;
    }

    const root = window.Shopify?.routes?.root || '/';

    return root + fallback;
  }

  /* -----------------------------------------------------
     AJAX ADD TO CART
     ----------------------------------------------------- */

  async addRecommendedProduct(button) {
    if (!button || this.riyanAddingProduct) {
      return;
    }

    const variantId = Number(
      button.dataset.variantId ||
      button.dataset.riyanVariantId
    );

    const quantity = Number(
      button.dataset.quantity || 1
    );

    if (
      !Number.isSafeInteger(variantId) ||
      variantId <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      this.showRecommendationError(
        button,
        'Please select a valid product option.'
      );
      return;
    }

    this.riyanAddingProduct = true;

    const originalText = button.textContent;

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Adding...';

    this.clearRecommendationError(button);

    try {
      const cartAddUrl = this.getCartRoute(
        'cart_add_url',
        'cart/add'
      );

      const response = await fetch(cartAddUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          items: [
            {
              id: variantId,
              quantity: quantity
            }
          ],
          sections: [
            'cart-drawer',
            'cart-icon-bubble'
          ],
          sections_url: window.location.pathname
        })
      });

      const responseData = await response.json();

      if (!response.ok || responseData.status) {
        throw new Error(
          responseData.description ||
          responseData.message ||
          'This product could not be added.'
        );
      }

      button.textContent = 'Added ✓';

      const sectionMarkup = responseData.sections || {};

      if (
        sectionMarkup['cart-drawer'] &&
        sectionMarkup['cart-icon-bubble']
      ) {
        this.renderContents({
          id: variantId,
          sections: sectionMarkup
        });
      } else {
        await this.refreshCartDrawer();
      }

      this.dispatchEvent(
        new CustomEvent('riyan:product-added', {
          bubbles: true,
          detail: {
            variantId: variantId,
            quantity: quantity
          }
        })
      );

    } catch (error) {
      console.error(
        'Riyan Cart: Add to Cart failed:',
        error
      );

      this.showRecommendationError(
        button,
        error.message ||
        'Unable to add product. Please try again.'
      );

      button.textContent = originalText;
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');

      if (button.isConnected && button.textContent === 'Added ✓') {
        button.textContent = originalText;
      }

      this.riyanAddingProduct = false;
    }
  }

  /* -----------------------------------------------------
     PRODUCT RECOMMENDATION CLICK HANDLER
     ----------------------------------------------------- */

  onPremiumCartClick(event) {
    const addButton = event.target.closest(
      '[data-riyan-add], [data-riyan-add-to-cart]'
    );

    if (!addButton || !this.contains(addButton)) {
      return;
    }

    event.preventDefault();

    if (addButton.disabled) {
      return;
    }

    this.addRecommendedProduct(addButton);
  }

  /* -----------------------------------------------------
     RECOMMENDATION ERROR HANDLING
     ----------------------------------------------------- */

  showRecommendationError(button, message) {
    if (!button) return;

    let errorContainer = button.parentElement?.querySelector(
      '.riyan-recommendation-error'
    );

    if (!errorContainer) {
      errorContainer = document.createElement('p');

      errorContainer.className =
        'riyan-recommendation-error';

      errorContainer.setAttribute('role', 'alert');

      button.insertAdjacentElement(
        'afterend',
        errorContainer
      );
    }

    errorContainer.textContent = message;
  }

  clearRecommendationError(button) {
    const errorContainer = button.parentElement?.querySelector(
      '.riyan-recommendation-error'
    );

    if (errorContainer) {
      errorContainer.remove();
    }
  }

  /* -----------------------------------------------------
     REFRESH CART USING SHOPIFY SECTIONS
     ----------------------------------------------------- */

  async refreshCartDrawer() {
    if (this.riyanRefreshPromise) {
      return this.riyanRefreshPromise;
    }

    this.riyanRefreshPromise = this.performCartRefresh();

    try {
      await this.riyanRefreshPromise;
    } finally {
      this.riyanRefreshPromise = null;
    }
  }

  async performCartRefresh() {
    const root = window.Shopify?.routes?.root || '/';

    const url = new URL(
      root + 'cart',
      window.location.origin
    );

    url.searchParams.set(
      'sections',
      'cart-drawer,cart-icon-bubble'
    );

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error(
        'Unable to refresh the cart.'
      );
    }

    const sections = await response.json();

    if (!sections['cart-drawer']) {
      throw new Error(
        'Cart drawer response is unavailable.'
      );
    }

    this.renderContents({
      id: this.productId,
      sections: sections
    });
  }

  /* -----------------------------------------------------
     RENDER UPDATED CART CONTENT
     Used by Dawn product forms and AJAX interactions.
     ----------------------------------------------------- */

  renderContents(parsedState) {
    if (!parsedState || !parsedState.sections) {
      return;
    }

    const inner = this.querySelector('.drawer__inner');

    if (inner) {
      inner.classList.remove('is-empty');
    }

    if (parsedState.id) {
      this.productId = parsedState.id;
    }

    this.getSectionsToRender().forEach((section) => {
      const sectionHTML = parsedState.sections[section.id];

      if (!sectionHTML) return;

      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;

      try {
        const newHTML = this.getSectionInnerHTML(
          sectionHTML,
          section.selector
        );

        sectionElement.innerHTML = newHTML;

      } catch (error) {
        console.error(
          `Riyan Cart: Error rendering ${section.id}`,
          error
        );
      }
    });

    this.setupPremiumAccessibility();
    this.syncDrawerState();

    const overlay = this.querySelector(
      '#CartDrawer-Overlay'
    );

    if (overlay) {
      overlay.removeEventListener(
        'click',
        this.onOverlayClick
      );

      overlay.addEventListener(
        'click',
        this.onOverlayClick
      );
    }

    requestAnimationFrame(() => {
      if (!this.classList.contains('active')) {
        this.open();
      } else {
        const items = this.querySelector(
          'cart-drawer-items'
        );

        if (
          items &&
          typeof items.dispatchViewEvent === 'function'
        ) {
          items.dispatchViewEvent();
        }
      }
    });
  }

  /* -----------------------------------------------------
     DETECT EMPTY CART
     ----------------------------------------------------- */

  syncDrawerState() {
    const cartItems = this.querySelector(
      'cart-drawer-items'
    );

    if (!cartItems) return;

    const isEmpty = cartItems.classList.contains(
      'is-empty'
    );

    this.classList.toggle(
      'is-empty',
      isEmpty
    );
  }

  /* -----------------------------------------------------
     SECTION HTML PARSING
     ----------------------------------------------------- */

  getSectionInnerHTML(
    html,
    selector = '.shopify-section'
  ) {
    if (typeof html !== 'string') {
      throw new Error('Invalid section HTML.');
    }

    const parsedDocument = new DOMParser().parseFromString(
      html,
      'text/html'
    );

    const element = parsedDocument.querySelector(
      selector
    );

    if (!element) {
      throw new Error(
        `Section selector not found: ${selector}`
      );
    }

    return element.innerHTML;
  }

  /* -----------------------------------------------------
     SECTIONS FOR DAWN ADD TO CART
     ----------------------------------------------------- */

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer'
      },
      {
        id: 'cart-icon-bubble'
      }
    ];
  }

  /* -----------------------------------------------------
     GET SECTION DOM ELEMENT
     ----------------------------------------------------- */

  getSectionDOM(
    html,
    selector = '.shopify-section'
  ) {
    const parsedDocument = new DOMParser().parseFromString(
      html,
      'text/html'
    );

    return parsedDocument.querySelector(
      selector
    );
  }

  /* -----------------------------------------------------
     SAVE PREVIOUSLY FOCUSED ELEMENT
     ----------------------------------------------------- */

  setActiveElement(element) {
    this.activeElement = element;
  }
}

/* =========================================================
   REGISTER CART DRAWER
   ========================================================= */

if (!customElements.get('cart-drawer')) {
  customElements.define(
    'cart-drawer',
    CartDrawer
  );
}

/* =========================================================
   CART DRAWER ITEMS
   Extends Dawn CartItems class from cart.js
   ========================================================= */

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner'
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section'
      }
    ];
  }
}

/* =========================================================
   REGISTER CART DRAWER ITEMS
   ========================================================= */

if (!customElements.get('cart-drawer-items')) {
  customElements.define(
    'cart-drawer-items',
    CartDrawerItems
  );
}

/* =========================================================
   END — RIYAN PREMIUM CART DRAWER JS
   ========================================================= */
