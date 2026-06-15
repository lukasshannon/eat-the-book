/**
 * turn.js 3rd release
 * www.turnjs.com
 *
 * Copyright (C) 2012, Emmanuel Garcia.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *
 * 2. Any redistribution, use, or modification is done solely for personal
 * benefit and not for any commercial purpose or for monetary gain.
 *
 **/

(function () {
  "use strict";

  /**
   * Dependency-free page turning runtime inspired by the public turn.js API.
   *
   * This module intentionally keeps the original turn/flip algorithms in one file
   * so legacy book pages can be initialized without jQuery or an external build
   * step.  The small `TurnDomCollection` helper below provides only the DOM
   * operations needed by this runtime: element selection/creation, style and
   * attribute updates, local element state, event registration/dispatch, and
   * simple animation timing.  It is not intended to be a general-purpose DOM
   * library.
   *
   * Public integration points:
   * - `window.turnDom(selectorOrElement)` creates a `TurnDomCollection`.
   * - `Element.prototype.turn(...)` invokes the turn book API on one element.
   * - `Element.prototype.flip(...)` invokes the page flip API on one element.
   *
   * Internal terminology:
   * - A "turn" owns the full book, page ordering, view state, and navigation.
   * - A "flip" owns the animated folding behavior for one physical page.
   * - A "folding page" is the back-side page temporarily moved into the flip
   *   wrapper while the page curl is visible.
   */

  /**
   * Lightweight array-like collection used by this module instead of jQuery.
   *
   * @constructor
   * @param {Array<Element|Document|Window>} elements Elements wrapped by the collection.
   */
  function TurnDomCollection(elements) {
    Array.prototype.push.apply(this, elements || []);
  }

  /**
   * Creates a turn DOM collection from an element, selector, HTML tag string, or array-like object.
   *
   * @param {string|Element|Document|Window|ArrayLike<Element>|TurnDomCollection} input Source to wrap.
   * @param {{class?: string, styles?: Object<string, string|number>, [name: string]: *}=} attributes Optional attributes applied when creating elements.
   * @returns {TurnDomCollection} Wrapped DOM collection.
   */
  function createTurnDomCollection(input, attributes) {
    var elements;

    if (input instanceof TurnDomCollection) return input;
    else if (typeof input == "string") {
      var tagMatch = input.match(/^<([a-z0-9-]+)\s*\/?>(?:<\/\1>)?$/i);
      elements = tagMatch
        ? [document.createElement(tagMatch[1])]
        : Array.prototype.slice.call(document.querySelectorAll(input));
    } else if (
      input === window ||
      input === document ||
      input instanceof Element
    )
      elements = [input];
    else if (input && typeof input.length == "number")
      elements = Array.prototype.slice.call(input);
    else elements = [];

    var collection = new TurnDomCollection(elements);
    if (attributes) {
      if (attributes["class"]) collection.addClass(attributes["class"]);
      if (attributes.styles) collection.style(attributes.styles);
      for (var name in attributes)
        if (has(name, attributes) && name != "class" && name != "styles")
          collection.attribute(name, attributes[name]);
    }
    return collection;
  }

  /**
   * Shallowly copies enumerable own properties from each source into the target.
   *
   * @param {Object} target Object receiving properties.
   * @param {...Object} sources Objects whose own properties are copied.
   * @returns {Object} The mutated target object.
   */
  function extendObject() {
    var target = arguments[0] || {};
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      if (!source) continue;
      for (var key in source) if (has(key, source)) target[key] = source[key];
    }
    return target;
  }

  /**
   * Finds a value in an array-like object.
   *
   * @param {*} value Value to find.
   * @param {ArrayLike<*>} array Array-like object to search.
   * @returns {number} Zero-based index, or -1 when the value is absent.
   */
  function arrayIndexOf(value, array) {
    return Array.prototype.indexOf.call(array || [], value);
  }

  /**
   * Creates a cancelable DOM event with the legacy `isDefaultPrevented` helper.
   *
   * @param {string} type Event name.
   * @returns {Event} DOM event with jQuery-compatible prevention inspection.
   */
  function createTurnEvent(type) {
    var event = new Event(type, { bubbles: true, cancelable: true });
    event.isDefaultPrevented = function () {
      return event.defaultPrevented;
    };
    return event;
  }

  TurnDomCollection.prototype = Object.create(Array.prototype);
  TurnDomCollection.prototype.constructor = TurnDomCollection;

  /**
   * Iterates over every wrapped item and preserves chainability.
   *
   * @param {Function} callback Called with `(index, element)` and the element as `this`.
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.eachElement = function (callback) {
    for (var i = 0; i < this.length; i++) callback.call(this[i], i, this[i]);
    return this;
  };

  /**
   * Reads or extends module-private state stored on the first wrapped element.
   *
   * @param {Object=} value Optional partial state to merge.
   * @returns {Object|undefined} State object for the first element, when present.
   */
  TurnDomCollection.prototype.state = function (value) {
    if (!this[0]) return undefined;
    if (!this[0].__turnData) this[0].__turnData = {};
    if (value) extendObject(this[0].__turnData, value);
    return this[0].__turnData;
  };

  /**
   * Returns child elements for the first wrapped element.
   *
   * @param {string=} selector Supports `:first-child` for legacy call sites.
   * @returns {TurnDomCollection} Collection containing matching child elements.
   */
  TurnDomCollection.prototype.children = function (selector) {
    if (!this[0]) return new TurnDomCollection([]);
    var children = Array.prototype.slice.call(this[0].children);
    if (selector == ":first-child") children = children.slice(0, 1);
    return new TurnDomCollection(children);
  };

  /**
   * Returns the parent element of the first wrapped element.
   *
   * @returns {TurnDomCollection} Collection containing the parent, or empty when unavailable.
   */
  TurnDomCollection.prototype.parent = function () {
    return new TurnDomCollection(
      this[0] && this[0].parentElement ? [this[0].parentElement] : [],
    );
  };

  /**
   * Gets one computed style property or applies a set of inline styles.
   *
   * Numeric values are written as pixel values to match previous jQuery behavior.
   *
   * @param {string|Object<string, string|number>} styles Property name to read or style map to write.
   * @returns {string|TurnDomCollection|undefined} Style value for reads; this collection for writes.
   */
  TurnDomCollection.prototype.style = function (styles) {
    if (typeof styles == "string")
      return this[0]
        ? getComputedStyle(this[0]).getPropertyValue(styles) ||
            this[0].style[styles]
        : undefined;
    return this.eachElement(function () {
      for (var key in styles)
        if (has(key, styles))
          this.style.setProperty(
            key,
            typeof styles[key] == "number" ? styles[key] + "px" : styles[key],
          );
    });
  };

  /**
   * Measures the first wrapped element's rendered width.
   *
   * @returns {number} Width in CSS pixels, or 0 for an empty collection.
   */
  TurnDomCollection.prototype.width = function () {
    return this[0] ? this[0].getBoundingClientRect().width : 0;
  };
  /**
   * Measures the first wrapped element's rendered height.
   *
   * @returns {number} Height in CSS pixels, or 0 for an empty collection.
   */
  TurnDomCollection.prototype.height = function () {
    return this[0] ? this[0].getBoundingClientRect().height : 0;
  };
  /**
   * Calculates the document-relative top/left position of the first element.
   *
   * @returns {{top: number, left: number}} Offset in CSS pixels.
   */
  TurnDomCollection.prototype.offset = function () {
    if (!this[0]) return { top: 0, left: 0 };
    var rect = this[0].getBoundingClientRect();
    return {
      top: rect.top + window.pageYOffset,
      left: rect.left + window.pageXOffset,
    };
  };

  /**
   * Adds one or more classes to each wrapped element.
   *
   * @param {string} name Space-separated class names.
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.addClass = function (name) {
    return this.eachElement(function () {
      this.classList.add.apply(this.classList, name.split(/\s+/));
    });
  };
  /**
   * Removes one or more classes from each wrapped element.
   *
   * @param {string} name Space-separated class names.
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.removeClass = function (name) {
    return this.eachElement(function () {
      this.classList.remove.apply(this.classList, name.split(/\s+/));
    });
  };
  /**
   * Gets or sets an attribute on wrapped elements.
   *
   * @param {string} name Attribute name.
   * @param {*=} value Optional value to set.
   * @returns {string|TurnDomCollection|undefined} Attribute value for reads; this collection for writes.
   */
  TurnDomCollection.prototype.attribute = function (name, value) {
    if (value === undefined)
      return this[0] ? this[0].getAttribute(name) : undefined;
    return this.eachElement(function () {
      this.setAttribute(name, value);
    });
  };
  /**
   * Appends a child to each wrapped element.
   *
   * @param {Element|TurnDomCollection} child Child to append.
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.append = function (child) {
    var node = createTurnDomCollection(child)[0];
    return this.eachElement(function () {
      if (node) this.appendChild(node);
    });
  };
  /**
   * Prepends a child to each wrapped element.
   *
   * @param {Element|TurnDomCollection} child Child to prepend.
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.prepend = function (child) {
    var node = createTurnDomCollection(child)[0];
    return this.eachElement(function () {
      if (node) this.insertBefore(node, this.firstChild);
    });
  };
  /**
   * Appends this collection's first element to a parent.
   *
   * @param {Element|TurnDomCollection|string} parent Parent target.
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.appendTo = function (parent) {
    createTurnDomCollection(parent).append(this);
    return this;
  };
  /**
   * Removes each wrapped element from its current parent.
   *
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.remove = function () {
    return this.eachElement(function () {
      if (this.parentNode) this.parentNode.removeChild(this);
    });
  };
  /**
   * Hides each wrapped element with `display: none`.
   *
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.hide = function () {
    return this.style({ display: "none" });
  };
  /**
   * Clears inline `display` so each wrapped element can become visible.
   *
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.show = function () {
    return this.style({ display: "" });
  };
  /**
   * Tests the first wrapped element against a selector or the legacy `:visible` check.
   *
   * @param {string} selector Selector to test.
   * @returns {boolean} True when the element matches.
   */
  TurnDomCollection.prototype.matchesSelector = function (selector) {
    return selector == ":visible"
      ? !!(this[0] && this[0].offsetParent !== null)
      : !!(this[0] && this[0].matches(selector));
  };
  /**
   * Registers a DOM event handler and forwards custom turn arguments.
   *
   * Returning `false` from the handler prevents the default action and stops propagation,
   * preserving the behavior the original jQuery event layer relied on.
   *
   * @param {string} type Event name.
   * @param {Function} handler Event handler.
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.on = function (type, handler) {
    return this.eachElement(function () {
      this.addEventListener(type, function (nativeEvent) {
        nativeEvent.originalEvent = nativeEvent;
        var args = [nativeEvent].concat(nativeEvent.turnArgs || []);
        var result = handler.apply(this, args);
        if (result === false) {
          nativeEvent.preventDefault();
          nativeEvent.stopPropagation();
        }
        return result;
      });
    });
  };
  /**
   * Dispatches a named or pre-created event on each wrapped element.
   *
   * @param {string|Event} event Event name or event object.
   * @param {Array<*>=} args Additional arguments exposed to handlers as `event.turnArgs`.
   * @returns {TurnDomCollection} This collection.
   */
  TurnDomCollection.prototype.dispatch = function (event, args) {
    var evt = typeof event == "string" ? createTurnEvent(event) : event;
    evt.turnArgs = args || [];
    return this.eachElement(function () {
      this.dispatchEvent(evt);
    });
  };

  var has3d,
    vendor = "",
    PI = Math.PI,
    A90 = PI / 2,
    isTouch = "ontouchstart" in window,
    events = isTouch
      ? { start: "touchstart", move: "touchmove", end: "touchend" }
      : { start: "mousedown", move: "mousemove", end: "mouseup" },
    // Contansts used for each corner
    // tl * tr
    // *     *
    // bl * br

    corners = {
      backward: ["bl", "tl"],
      forward: ["br", "tr"],
      all: ["tl", "bl", "tr", "br"],
    },
    displays = ["single", "double"],
    // Default options

    turnOptions = {
      // First page

      page: 1,

      // Enables gradients

      gradients: true,

      // Duration of transition in milliseconds

      duration: 600,

      // Enables hardware acceleration

      acceleration: true,

      // Display

      display: "double",

      // Events

      when: null,
    },
    flipOptions = {
      // Back page

      folding: null,

      // Corners
      // backward: Activates both tl and bl corners
      // forward: Activates both tr and br corners
      // all: Activates all the corners

      corners: "forward",

      // Size of the active zone of each corner

      cornerSize: 100,

      // Enables gradients

      gradients: true,

      // Duration of transition in milliseconds

      duration: 600,

      // Enables hardware acceleration

      acceleration: true,
    },
    // Number of pages in the DOM, minimum value: 6

    pagesInDOM = 6,
    pagePosition = {
      0: { top: 0, left: 0, right: "auto", bottom: "auto" },
      1: { top: 0, right: 0, left: "auto", bottom: "auto" },
    },
    /**
     * Builds the attributes object used when creating positioned wrapper elements.
     *
     * @param {number|string} top Top offset.
     * @param {number|string} left Left offset.
     * @param {number|string=} zIndex Optional z-index.
     * @param {string=} overf Optional overflow value.
     * @returns {{styles:Object<string, string|number>}} Element creation attributes.
     */
    divAtt = function (top, left, zIndex, overf) {
      return {
        styles: {
          position: "absolute",
          top: top,
          left: left,
          overflow: overf || "hidden",
          "z-index": zIndex || "auto",
        },
      };
    },
    /**
     * Samples a cubic Bezier curve used by the page-curl animations.
     *
     * @param {{x:number,y:number}} p1 First control point.
     * @param {{x:number,y:number}} p2 Second control point.
     * @param {{x:number,y:number}} p3 Third control point.
     * @param {{x:number,y:number}} p4 Fourth control point.
     * @param {number} t Interpolation amount from 0 to 1.
     * @returns {{x:number,y:number}} Rounded point on the curve.
     */
    bezier = function (p1, p2, p3, p4, t) {
      var mum1 = 1 - t,
        mum13 = mum1 * mum1 * mum1,
        mu3 = t * t * t;

      return point2D(
        Math.round(
          mum13 * p1.x +
            3 * t * mum1 * mum1 * p2.x +
            3 * t * t * mum1 * p3.x +
            mu3 * p4.x,
        ),
        Math.round(
          mum13 * p1.y +
            3 * t * mum1 * mum1 * p2.y +
            3 * t * t * mum1 * p3.y +
            mu3 * p4.y,
        ),
      );
    },
    /**
     * Converts degrees to radians.
     *
     * @param {number} degrees Angle in degrees.
     * @returns {number} Angle in radians.
     */
    rad = function (degrees) {
      return (degrees / 180) * PI;
    },
    /**
     * Converts radians to degrees.
     *
     * @param {number} radians Angle in radians.
     * @returns {number} Angle in degrees.
     */
    deg = function (radians) {
      return (radians / PI) * 180;
    },
    /**
     * Creates a simple 2D point object.
     *
     * @param {number} x X coordinate.
     * @param {number} y Y coordinate.
     * @returns {{x:number,y:number}} Point object.
     */
    point2D = function (x, y) {
      return { x: x, y: y };
    },
    /**
     * Creates a CSS translate transform string.
     *
     * @param {number} x Horizontal translation in pixels.
     * @param {number} y Vertical translation in pixels.
     * @param {boolean} use3d Whether 3D translation may be used when available.
     * @returns {string} CSS transform fragment.
     */
    translate = function (x, y, use3d) {
      return has3d && use3d
        ? " translate3d(" + x + "px," + y + "px, 0px) "
        : " translate(" + x + "px, " + y + "px) ";
    },
    /**
     * Creates a CSS rotate transform string.
     *
     * @param {number} degrees Rotation angle in degrees.
     * @returns {string} CSS transform fragment.
     */
    rotate = function (degrees) {
      return " rotate(" + degrees + "deg) ";
    },
    /**
     * Safely checks whether an object owns a property.
     *
     * @param {string|number} property Property name.
     * @param {Object} object Object to inspect.
     * @returns {boolean} True when the property is an own property.
     */
    has = function (property, object) {
      return Object.prototype.hasOwnProperty.call(object, property);
    },
    /**
     * Detects the CSS transform vendor prefix required by the current browser.
     *
     * @returns {string} Vendor prefix such as `-webkit-`, or an empty string.
     */
    getPrefix = function () {
      var vendorPrefixes = ["Moz", "Webkit", "Khtml", "O", "ms"],
        len = vendorPrefixes.length,
        vendor = "";

      while (len--)
        if (vendorPrefixes[len] + "Transform" in document.body.style)
          vendor = "-" + vendorPrefixes[len].toLowerCase() + "-";

      return vendor;
    },
    /**
     * Applies a directional gradient to a wrapper element for page shadows.
     *
     * @param {TurnDomCollection} obj Target element collection.
     * @param {{x:number,y:number}} p0 Gradient start point in percentages.
     * @param {{x:number,y:number}} p1 Gradient end point in percentages.
     * @param {Array<[number,string]>} colors Color stops.
     * @param {number} numColors Number of color stops to apply.
     */
    gradient = function (obj, p0, p1, colors, numColors) {
      var j,
        cols = [];

      if (vendor == "-webkit-") {
        for (j = 0; j < numColors; j++)
          cols.push("color-stop(" + colors[j][0] + ", " + colors[j][1] + ")");

        obj.style({
          "background-image":
            "-webkit-gradient(linear, " +
            p0.x +
            "% " +
            p0.y +
            "%,  " +
            p1.x +
            "% " +
            p1.y +
            "%, " +
            cols.join(",") +
            " )",
        });
      } else {
        // This procedure makes the gradients for non-webkit browsers
        // It will be reduced to one unique way for gradients in next versions

        p0 = { x: (p0.x / 100) * obj.width(), y: (p0.y / 100) * obj.height() };
        p1 = { x: (p1.x / 100) * obj.width(), y: (p1.y / 100) * obj.height() };

        var dx = p1.x - p0.x,
          dy = p1.y - p0.y,
          angle = Math.atan2(dy, dx),
          angle2 = angle - Math.PI / 2,
          diagonal =
            Math.abs(obj.width() * Math.sin(angle2)) +
            Math.abs(obj.height() * Math.cos(angle2)),
          gradientDiagonal = Math.sqrt(dy * dy + dx * dx),
          corner = point2D(
            p1.x < p0.x ? obj.width() : 0,
            p1.y < p0.y ? obj.height() : 0,
          ),
          slope = Math.tan(angle),
          inverse = -1 / slope,
          x =
            (inverse * corner.x - corner.y - slope * p0.x + p0.y) /
            (inverse - slope),
          c = { x: x, y: inverse * x - inverse * corner.x + corner.y },
          segA = Math.sqrt(Math.pow(c.x - p0.x, 2) + Math.pow(c.y - p0.y, 2));

        for (j = 0; j < numColors; j++)
          cols.push(
            " " +
              colors[j][1] +
              " " +
              ((segA + gradientDiagonal * colors[j][0]) * 100) / diagonal +
              "%",
          );

        obj.style({
          "background-image":
            vendor +
            "linear-gradient(" +
            -angle +
            "rad," +
            cols.join(",") +
            ")",
        });
      }
    },
    /**
     * Public and private methods that manage full-book state: page order, current
     * view, mounted page range, z-indexing, and turn-level events.
     *
     * Methods prefixed with `_` are private implementation details and cannot be
     * called through the external dispatcher.
     */
    turnMethods = {
      // Singleton constructor
      // createTurnDomCollection('#selector').turn([options]);

      /**
       * Initializes a turn book or flip page, depending on the method table currently dispatching.
       *
       * @param {Object=} opts Runtime options merged with defaults.
       * @returns {TurnDomCollection} The active collection for chaining.
       */
      init: function (opts) {
        // Define constants
        if (has3d === undefined) {
          has3d =
            "WebKitCSSMatrix" in window ||
            "MozPerspective" in document.body.style;
          vendor = getPrefix();
        }

        var i,
          data = this.state(),
          ch = this.children();

        opts = extendObject(
          { width: this.width(), height: this.height() },
          turnOptions,
          opts,
        );
        data.opts = opts;
        data.pageObjs = {};
        data.pages = {};
        data.pageWrap = {};
        data.pagePlace = {};
        data.pageMv = [];
        data.totalPages = opts.pages || 0;

        if (opts.when)
          for (i in opts.when) if (has(i, opts.when)) this.on(i, opts.when[i]);

        this.style({
          position: "relative",
          width: opts.width,
          height: opts.height,
        });

        this.turn("display", opts.display);

        if (has3d && !isTouch && opts.acceleration)
          this.transform(translate(0, 0, true));

        for (i = 0; i < ch.length; i++) this.turn("addPage", ch[i], i + 1);

        this.turn("page", opts.page);

        // allow setting active corners as an option
        corners = extendObject({}, corners, opts.corners);

        // Event listeners

        createTurnDomCollection(this).on(events.start, function (e) {
          for (var page in data.pages)
            if (
              has(page, data.pages) &&
              flipMethods._eventStart.call(data.pages[page], e) === false
            )
              return false;
        });

        createTurnDomCollection(document)
          .on(events.move, function (e) {
            for (var page in data.pages)
              if (has(page, data.pages))
                flipMethods._eventMove.call(data.pages[page], e);
          })
          .on(events.end, function (e) {
            for (var page in data.pages)
              if (has(page, data.pages))
                flipMethods._eventEnd.call(data.pages[page], e);
          });

        data.done = true;

        return this;
      },

      // Adds a page from external data

      /**
       * Adds a page element to the turn book and updates page bookkeeping.
       *
       * @param {Element|TurnDomCollection} element Page element to insert.
       * @param {number=} page One-based page number.
       * @returns {TurnDomCollection} The book collection.
       */
      addPage: function (element, page) {
        var incPages = false,
          data = this.state(),
          lastPage = data.totalPages + 1;

        if (page) {
          if (page == lastPage) {
            page = lastPage;
            incPages = true;
          } else if (page > lastPage)
            throw new Error(
              'It is impossible to add the page "' +
                page +
                '", the maximum value is: "' +
                lastPage +
                '"',
            );
        } else {
          page = lastPage;
          incPages = true;
        }

        if (page >= 1 && page <= lastPage) {
          // Stop animations
          if (data.done) this.turn("stop");

          // Move pages if it's necessary
          if (page in data.pageObjs) turnMethods._movePages.call(this, page, 1);

          // Update number of pages
          if (incPages) data.totalPages = lastPage;

          // Add element
          data.pageObjs[page] = createTurnDomCollection(element).addClass(
            "turn-page p" + page,
          );

          // Add page
          turnMethods._addPage.call(this, page);

          // Update view
          if (data.done) this.turn("update");

          turnMethods._removeFromDOM.call(this);
        }

        return this;
      },

      // Adds a page from internal data

      /**
       * Ensures a page is represented in the DOM when it is needed for the active range.
       *
       * @param {number} page One-based page number.
       */
      _addPage: function (page) {
        var data = this.state(),
          element = data.pageObjs[page];

        if (element)
          if (turnMethods._necessPage.call(this, page)) {
            if (!data.pageWrap[page]) {
              var pageWidth =
                  data.display == "double" ? this.width() / 2 : this.width(),
                pageHeight = this.height();

              element.style({ width: pageWidth, height: pageHeight });

              // Place
              data.pagePlace[page] = page;

              // Wrapper
              data.pageWrap[page] = createTurnDomCollection("<div/>", {
                class: "turn-page-wrapper",
                page: page,
                styles: {
                  position: "absolute",
                  overflow: "hidden",
                  width: pageWidth,
                  height: pageHeight,
                },
              }).style(pagePosition[data.display == "double" ? page % 2 : 0]);

              // Append to this
              this.append(data.pageWrap[page]);

              // Move data.pageObjs[page] (element) to wrapper
              data.pageWrap[page].prepend(data.pageObjs[page]);
            }

            // If the page is in the current view, create the flip effect
            if (!page || turnMethods._setPageLoc.call(this, page) == 1)
              turnMethods._makeFlip.call(this, page);
          } else {
            // Place
            data.pagePlace[page] = 0;

            // Remove element from the DOM
            if (data.pageObjs[page]) data.pageObjs[page].remove();
          }
      },

      // Checks if a page is in memory

      /**
       * Reports whether the book knows about a page.
       *
       * @param {number} page One-based page number.
       * @returns {boolean} True when the page exists in book state.
       */
      hasPage: function (page) {
        return page in this.state().pageObjs;
      },

      // Prepares the flip effect for a page

      /**
       * Creates and wires flip behavior for a visible page.
       *
       * @param {number} page One-based page number.
       * @returns {TurnDomCollection|undefined} Page collection when available.
       */
      _makeFlip: function (page) {
        var data = this.state();

        if (!data.pages[page] && data.pagePlace[page] == page) {
          var single = data.display == "single",
            even = page % 2;

          data.pages[page] = data.pageObjs[page]
            .style({
              width: single ? this.width() : this.width() / 2,
              height: this.height(),
            })
            .flip({
              page: page,
              next:
                single && page === data.totalPages
                  ? page - 1
                  : even || single
                    ? page + 1
                    : page - 1,
              turn: this,
              duration: data.opts.duration,
              acceleration: data.opts.acceleration,
              corners: single ? "all" : even ? "forward" : "backward",
              backGradient: data.opts.gradients,
              frontGradient: data.opts.gradients,
            })
            .flip("disable", data.disabled)
            .on("pressed", turnMethods._pressed)
            .on("released", turnMethods._released)
            .on("start", turnMethods._start)
            .on("end", turnMethods._end)
            .on("flip", turnMethods._flip);
        }
        return data.pages[page];
      },

      // Makes pages within a range

      /**
       * Materializes the pages that should remain in the DOM around the current view.
       */
      _makeRange: function () {
        var page,
          data = this.state(),
          range = this.turn("range");

        for (page = range[0]; page <= range[1]; page++)
          turnMethods._addPage.call(this, page);
      },

      // Returns a range of `pagesInDOM` pages that should be in the DOM
      // Example:
      // - page of the current view, return true
      // * page is in the range, return true
      // 0 page is not in the range, return false
      //
      // 1 2-3 4-5 6-7 8-9 10-11 12-13
      //    **  **  --   **  **

      /**
       * Calculates the inclusive page range that should stay mounted.
       *
       * @param {number=} page Page used as the range center.
       * @returns {[number, number]} Inclusive first and last page numbers.
       */
      range: function (page) {
        var remainingPages,
          left,
          right,
          data = this.state();
        page = page || data.tpage || data.page;
        var view = turnMethods._view.call(this, page);

        if (page < 1 || page > data.totalPages)
          throw new Error('"' + page + '" is not a page for range');

        view[1] = view[1] || view[0];

        if (view[0] >= 1 && view[1] <= data.totalPages) {
          remainingPages = Math.floor((pagesInDOM - 2) / 2);

          if (data.totalPages - view[1] > view[0]) {
            left = Math.min(view[0] - 1, remainingPages);
            right = 2 * remainingPages - left;
          } else {
            right = Math.min(data.totalPages - view[1], remainingPages);
            left = 2 * remainingPages - right;
          }
        } else {
          left = pagesInDOM - 1;
          right = pagesInDOM - 1;
        }

        return [
          Math.max(1, view[0] - left),
          Math.min(data.totalPages, view[1] + right),
        ];
      },

      // Detects if a page is within the range of `pagesInDOM` from the current view

      /**
       * Checks whether a page is necessary for the current in-memory range.
       *
       * @param {number} page Page number.
       * @returns {boolean} True when the page should remain mounted.
       */
      _necessPage: function (page) {
        if (page === 0) return true;

        var range = this.turn("range");

        return page >= range[0] && page <= range[1];
      },

      // Releases memory by removing pages from the DOM

      /**
       * Removes page wrappers that are outside the active in-memory range.
       */
      _removeFromDOM: function () {
        var page,
          data = this.state();

        for (page in data.pageWrap)
          if (
            has(page, data.pageWrap) &&
            !turnMethods._necessPage.call(this, page)
          )
            turnMethods._removePageFromDOM.call(this, page);
      },

      // Removes a page from DOM and its internal references

      /**
       * Removes one page, wrapper, and flip artifacts from the DOM.
       *
       * @param {number} page Page number to remove.
       */
      _removePageFromDOM: function (page) {
        var data = this.state();

        if (data.pages[page]) {
          var dd = data.pages[page].state();
          if (dd.f && dd.f.fwrapper) dd.f.fwrapper.remove();
          data.pages[page].remove();
          delete data.pages[page];
        }

        if (data.pageObjs[page]) data.pageObjs[page].remove();

        if (data.pageWrap[page]) {
          data.pageWrap[page].remove();
          delete data.pageWrap[page];
        }

        delete data.pagePlace[page];
      },

      // Removes a page

      /**
       * Removes a logical page from the book and shifts following pages.
       *
       * @param {number} page Page number to remove.
       * @returns {TurnDomCollection} The book collection.
       */
      removePage: function (page) {
        var data = this.state();

        if (data.pageObjs[page]) {
          // Stop animations
          this.turn("stop");

          // Remove `page`
          turnMethods._removePageFromDOM.call(this, page);
          delete data.pageObjs[page];

          // Move the pages behind `page`
          turnMethods._movePages.call(this, page, -1);

          // Resize the size of this magazine
          data.totalPages = data.totalPages - 1;
          turnMethods._makeRange.call(this);

          // Check the current view
          if (data.page > data.totalPages) this.turn("page", data.totalPages);
        }

        return this;
      },

      // Moves pages

      /**
       * Renumbers page state after insertion, removal, or display changes.
       *
       * @param {number} from First page to move.
       * @param {number} change Signed page-number delta.
       */
      _movePages: function (from, change) {
        var page,
          data = this.state(),
          single = data.display == "single",
          move = function (page) {
            var next = page + change,
              odd = next % 2;

            if (data.pageObjs[page])
              data.pageObjs[next] = data.pageObjs[page]
                .removeClass("page" + page)
                .addClass("page" + next);

            if (data.pagePlace[page] && data.pageWrap[page]) {
              data.pagePlace[next] = next;
              data.pageWrap[next] = data.pageWrap[page]
                .style(pagePosition[single ? 0 : odd])
                .attribute("page", next);

              if (data.pages[page])
                data.pages[next] = data.pages[page].flip("options", {
                  page: next,
                  next: single || odd ? next + 1 : next - 1,
                  corners: single ? "all" : odd ? "forward" : "backward",
                });

              if (change) {
                delete data.pages[page];
                delete data.pagePlace[page];
                delete data.pageObjs[page];
                delete data.pageWrap[page];
                delete data.pageObjs[page];
              }
            }
          };

        if (change > 0)
          for (page = data.totalPages; page >= from; page--) move(page);
        else for (page = from; page <= data.totalPages; page++) move(page);
      },

      // Sets or Gets the display mode

      /**
       * Gets or sets single/double-page display mode.
       *
       * @param {string=} display `single` or `double`.
       * @returns {string|TurnDomCollection} Current display for reads; book collection for writes.
       */
      display: function (display) {
        var data = this.state(),
          currentDisplay = data.display;

        if (display) {
          if (arrayIndexOf(display, displays) == -1)
            throw new Error('"' + display + '" is not a value for display');

          if (display == "single") {
            if (!data.pageObjs[0]) {
              this.turn("stop").style({ overflow: "hidden" });
              data.pageObjs[0] = createTurnDomCollection("<div />", {
                class: "turn-page p-temporal",
              })
                .style({ width: this.width(), height: this.height() })
                .appendTo(this);
            }
          } else {
            if (data.pageObjs[0]) {
              this.turn("stop").style({ overflow: "" });
              data.pageObjs[0].remove();
              delete data.pageObjs[0];
            }
          }

          data.display = display;

          if (currentDisplay) {
            var size = this.turn("size");
            turnMethods._movePages.call(this, 1, 0);
            this.turn("size", size.width, size.height).turn("update");
          }

          return this;
        } else return currentDisplay;
      },

      // Detects if the pages are being animated

      /**
       * Reports whether the book currently has active page motions.
       *
       * @returns {boolean} True when one or more pages are animating.
       */
      animating: function () {
        return this.state().pageMv.length > 0;
      },

      // Disables and enables the effect

      /**
       * Enables or disables turn/flip interactions.
       *
       * @param {boolean=} bool Disabled state.
       * @returns {TurnDomCollection} The active collection.
       */
      disable: function (bool) {
        var page,
          data = this.state(),
          view = this.turn("view");

        data.disabled = bool === undefined || bool === true;

        for (page in data.pages)
          if (has(page, data.pages))
            data.pages[page].flip(
              "disable",
              bool ? arrayIndexOf(page, view) : false,
            );

        return this;
      },

      // Gets and sets the size

      /**
       * Gets or sets book dimensions and resizes mounted pages.
       *
       * @param {number=} width Width in pixels.
       * @param {number=} height Height in pixels.
       * @returns {{width:number,height:number}|TurnDomCollection} Size for reads; book collection for writes.
       */
      size: function (width, height) {
        if (width && height) {
          var data = this.state(),
            pageWidth = data.display == "double" ? width / 2 : width,
            page;

          this.style({ width: width, height: height });

          if (data.pageObjs[0])
            data.pageObjs[0].style({ width: pageWidth, height: height });

          for (page in data.pageWrap) {
            if (!has(page, data.pageWrap)) continue;
            data.pageObjs[page].style({ width: pageWidth, height: height });
            data.pageWrap[page].style({ width: pageWidth, height: height });
            if (data.pages[page])
              data.pages[page].style({ width: pageWidth, height: height });
          }

          this.turn("resize");

          return this;
        } else {
          return { width: this.width(), height: this.height() };
        }
      },

      // Resizes each page

      /**
       * Recomputes flip geometry for mounted pages after a size or position change.
       */
      resize: function () {
        var page,
          data = this.state();

        if (data.pages[0]) {
          data.pageWrap[0].style({ left: -this.width() });
          data.pages[0].flip("resize", true);
        }

        for (page = 1; page <= data.totalPages; page++)
          if (data.pages[page]) data.pages[page].flip("resize", true);
      },

      // Removes an animation from the cache

      /**
       * Removes a page from the active motion list.
       *
       * @param {number} page Page number.
       * @returns {boolean} True when a motion entry was removed.
       */
      _removeMv: function (page) {
        var i,
          data = this.state();

        for (i = 0; i < data.pageMv.length; i++)
          if (data.pageMv[i] == page) {
            data.pageMv.splice(i, 1);
            return true;
          }

        return false;
      },

      // Adds an animation to the cache

      /**
       * Adds a page to the active motion list, replacing any existing entry.
       *
       * @param {number} page Page number.
       */
      _addMv: function (page) {
        var data = this.state();

        turnMethods._removeMv.call(this, page);
        data.pageMv.push(page);
      },

      // Gets indexes for a view

      /**
       * Calculates the raw logical view containing a page.
       *
       * @param {number=} page Page number.
       * @returns {Array<number>} One or two page numbers.
       */
      _view: function (page) {
        var data = this.state();
        page = page || data.page;

        if (data.display == "double")
          return page % 2 ? [page - 1, page] : [page, page + 1];
        else return [page];
      },

      // Gets a view

      /**
       * Returns the visible view, clamped to valid page numbers.
       *
       * @param {number=} page Page number.
       * @returns {Array<number>} Visible page numbers, with `0` for unavailable sides.
       */
      view: function (page) {
        var data = this.state(),
          view = turnMethods._view.call(this, page);

        return data.display == "double"
          ? [
              view[0] > 0 ? view[0] : 0,
              view[1] <= data.totalPages ? view[1] : 0,
            ]
          : [view[0] > 0 && view[0] <= data.totalPages ? view[0] : 0];
      },

      // Stops animations

      /**
       * Stops active animations and restores page placement.
       *
       * @param {boolean=} ok Legacy completion flag.
       * @returns {TurnDomCollection} The book collection.
       */
      stop: function (ok) {
        var i,
          opts,
          data = this.state(),
          pages = data.pageMv;

        data.pageMv = [];

        if (data.tpage) {
          data.page = data.tpage;
          delete data["tpage"];
        }

        for (i in pages) {
          if (!has(i, pages)) continue;
          opts = data.pages[pages[i]].state().f.opts;
          flipMethods._moveFoldingPage.call(data.pages[pages[i]], null);
          data.pages[pages[i]].flip("hideFoldedPage");
          data.pagePlace[opts.next] = opts.next;

          if (opts.force) {
            opts.next = opts.page % 2 === 0 ? opts.page - 1 : opts.page + 1;
            delete opts["force"];
          }
        }

        this.turn("update");

        return this;
      },

      // Gets and sets the number of pages

      /**
       * Gets or sets the total page count.
       *
       * @param {number=} pages New page count.
       * @returns {number|TurnDomCollection} Page count for reads; book collection for writes.
       */
      pages: function (pages) {
        var data = this.state();

        if (pages) {
          if (pages < data.totalPages) {
            for (var page = pages + 1; page <= data.totalPages; page++)
              this.turn("removePage", page);

            if (this.turn("page") > pages) this.turn("page", pages);
          }

          data.totalPages = pages;

          return this;
        } else return data.totalPages;
      },

      // Sets a page without effect

      /**
       * Moves to a page immediately without page-turn animation.
       *
       * @param {number} page Target page.
       * @param {boolean=} ok Legacy completion flag.
       */
      _fitPage: function (page, ok) {
        var data = this.state(),
          newView = this.turn("view", page);

        if (data.page != page) {
          this.dispatch("turning", [page, newView]);
          if (arrayIndexOf(1, newView) != -1) this.dispatch("first");
          if (arrayIndexOf(data.totalPages, newView) != -1)
            this.dispatch("last");
        }

        if (!data.pageObjs[page]) return;

        data.tpage = page;

        this.turn("stop", ok);
        turnMethods._removeFromDOM.call(this);
        turnMethods._makeRange.call(this);
        this.dispatch("turned", [page, newView]);
      },

      // Turns to a page

      /**
       * Moves to a page using a flip animation when possible.
       *
       * @param {number} page Target page.
       */
      _turnPage: function (page) {
        var current,
          next,
          data = this.state(),
          view = this.turn("view"),
          newView = this.turn("view", page);

        if (data.page != page) {
          this.dispatch("turning", [page, newView]);
          if (arrayIndexOf(1, newView) != -1) this.dispatch("first");
          if (arrayIndexOf(data.totalPages, newView) != -1)
            this.dispatch("last");
        }

        if (!data.pageObjs[page]) return;

        data.tpage = page;

        this.turn("stop");

        turnMethods._makeRange.call(this);

        if (data.display == "single") {
          current = view[0];
          next = newView[0];
        } else if (view[1] && page > view[1]) {
          current = view[1];
          next = newView[0];
        } else if (view[0] && page < view[0]) {
          current = view[0];
          next = newView[1];
        }

        if (data.pages[current]) {
          var opts = data.pages[current].state().f.opts;
          data.tpage = next;

          if (opts.next != next) {
            opts.next = next;
            data.pagePlace[next] = opts.page;
            opts.force = true;
          }

          if (data.display == "single")
            data.pages[current].flip(
              "turnPage",
              newView[0] > view[0] ? "br" : "bl",
            );
          else data.pages[current].flip("turnPage");
        }
      },

      // Gets and sets a page

      /**
       * Gets or sets the current page.
       *
       * @param {number|string=} page Target page.
       * @returns {number|TurnDomCollection} Current page for reads; book collection for writes.
       */
      page: function (page) {
        page = parseInt(page, 10);

        var data = this.state();

        if (page > 0 && page <= data.totalPages) {
          if (!data.done || arrayIndexOf(page, this.turn("view")) != -1)
            turnMethods._fitPage.call(this, page);
          else turnMethods._turnPage.call(this, page);

          return this;
        } else return data.page;
      },

      // Turns to the next view

      /**
       * Turns to the next logical view.
       *
       * @returns {TurnDomCollection} The book collection.
       */
      next: function () {
        var data = this.state();
        return this.turn(
          "page",
          turnMethods._view.call(this, data.page).pop() + 1,
        );
      },

      // Turns to the previous view

      /**
       * Turns to the previous logical view.
       *
       * @returns {TurnDomCollection} The book collection.
       */
      previous: function () {
        var data = this.state();
        return this.turn(
          "page",
          turnMethods._view.call(this, data.page).shift() - 1,
        );
      },

      // Adds a motion to the internal list

      /**
       * Registers the current flip page as moving and refreshes turn state.
       */
      _addMotionPage: function () {
        var opts = createTurnDomCollection(this).state().f.opts,
          turn = opts.turn,
          dd = turn.state();

        opts.pageMv = opts.page;
        turnMethods._addMv.call(turn, opts.pageMv);
        dd.pagePlace[opts.next] = opts.page;
        turn.turn("update");
      },

      // This event is called in context of flip

      /**
       * Handles the start of a flip gesture.
       *
       * @param {Event} e Source event.
       * @param {Object} opts Flip options.
       * @param {string} corner Active corner.
       */
      _start: function (e, opts, corner) {
        var data = opts.turn.state(),
          event = createTurnEvent("start");

        e.stopPropagation();

        opts.turn.dispatch(event, [opts, corner]);

        if (event.isDefaultPrevented()) {
          e.preventDefault();
          return;
        }

        if (data.display == "single") {
          var left = corner.charAt(1) == "l";
          if (
            (opts.page == 1 && left) ||
            (opts.page == data.totalPages && !left)
          )
            e.preventDefault();
          else {
            if (left) {
              opts.next = opts.next < opts.page ? opts.next : opts.page - 1;
              opts.force = true;
            } else
              opts.next = opts.next > opts.page ? opts.next : opts.page + 1;
          }
        }

        turnMethods._addMotionPage.call(this);
      },

      // This event is called in context of flip

      /**
       * Handles completion or cancellation of a flip gesture.
       *
       * @param {Event} e Source event.
       * @param {boolean} turned Whether the page completed a turn.
       */
      _end: function (e, turned) {
        var that = createTurnDomCollection(this),
          data = that.state().f,
          opts = data.opts,
          turn = opts.turn,
          dd = turn.state();

        e.stopPropagation();

        if (turned || dd.tpage) {
          if (dd.tpage == opts.next || dd.tpage == opts.page) {
            delete dd["tpage"];
            turnMethods._fitPage.call(turn, dd.tpage || opts.next, true);
          }
        } else {
          turnMethods._removeMv.call(turn, opts.pageMv);
          turn.turn("update");
        }
      },

      // This event is called in context of flip

      /**
       * Handles a page press and disables sibling flips while dragging.
       *
       * @returns {number} Press timestamp.
       */
      _pressed: function () {
        var page,
          that = createTurnDomCollection(this),
          data = that.state().f,
          turn = data.opts.turn,
          pages = turn.state().pages;

        for (page in pages)
          if (page != data.opts.page) pages[page].flip("disable", true);

        return (data.time = new Date().getTime());
      },

      // This event is called in context of flip

      /**
       * Handles a page release and decides whether to complete the turn.
       *
       * @param {Event} e Source event.
       * @param {{x:number,y:number}} point Release point.
       */
      _released: function (e, point) {
        var that = createTurnDomCollection(this),
          data = that.state().f;

        e.stopPropagation();

        if (
          new Date().getTime() - data.time < 200 ||
          point.x < 0 ||
          point.x > createTurnDomCollection(this).width()
        ) {
          e.preventDefault();
          data.opts.turn.state().tpage = data.opts.next;
          data.opts.turn.turn("update");
          createTurnDomCollection(that).flip("turnPage");
        }
      },

      // This event is called in context of flip

      /**
       * Emits the public `turn` notification when a flip commits.
       */
      _flip: function () {
        var opts = createTurnDomCollection(this).state().f.opts;

        opts.turn.dispatch("turn", [opts.next]);
      },

      // Calculate the z-index value for pages during the animation

      /**
       * Calculates page and wrapper z-index values during animation.
       *
       * @param {Array<number>} mv Moving page numbers.
       * @returns {{pageZ:Object,partZ:Object,pageV:Object}} Z-index and visibility maps.
       */
      calculateZ: function (mv) {
        var i,
          page,
          nextPage,
          placePage,
          dpage,
          that = this,
          data = this.state(),
          view = this.turn("view"),
          currentPage = view[0] || view[1],
          r = { pageZ: {}, partZ: {}, pageV: {} },
          addView = function (page) {
            var view = that.turn("view", page);
            if (view[0]) r.pageV[view[0]] = true;
            if (view[1]) r.pageV[view[1]] = true;
          };

        for (i = 0; i < mv.length; i++) {
          page = mv[i];
          nextPage = data.pages[page].state().f.opts.next;
          placePage = data.pagePlace[page];
          addView(page);
          addView(nextPage);
          dpage = data.pagePlace[nextPage] == nextPage ? nextPage : page;
          r.pageZ[dpage] = data.totalPages - Math.abs(currentPage - dpage);
          r.partZ[placePage] =
            data.totalPages * 2 + Math.abs(currentPage - dpage);
        }

        return r;
      },

      // Updates the z-index and display property of every page

      /**
       * Refreshes page visibility, z-index, disabled state, and flip geometry.
       */
      update: function () {
        var page,
          data = this.state();

        if (data.pageMv.length && data.pageMv[0] !== 0) {
          // Update motion

          var apage,
            pos = this.turn("calculateZ", data.pageMv),
            view = this.turn("view", data.tpage);

          if (data.pagePlace[view[0]] == view[0]) apage = view[0];
          else if (data.pagePlace[view[1]] == view[1]) apage = view[1];

          for (page in data.pageWrap) {
            if (!has(page, data.pageWrap)) continue;

            data.pageWrap[page].style({
              display: pos.pageV[page] ? "" : "none",
              "z-index": pos.pageZ[page] || 0,
            });

            if (data.pages[page]) {
              data.pages[page].flip("z", pos.partZ[page] || null);

              if (pos.pageV[page]) data.pages[page].flip("resize");

              if (data.tpage) data.pages[page].flip("disable", true); // data.disabled || page!=apage
            }
          }
        } else {
          // Update static pages

          for (page in data.pageWrap) {
            if (!has(page, data.pageWrap)) continue;
            var pageLocation = turnMethods._setPageLoc.call(this, page);
            if (data.pages[page])
              data.pages[page]
                .flip("disable", data.disabled || pageLocation != 1)
                .flip("z", null);
          }
        }
      },

      // Sets the z-index and display property of a page
      // It depends on the current view

      /**
       * Classifies and positions a page relative to the current view.
       *
       * @param {number} page Page number.
       * @returns {number} `1` visible, `2` adjacent, or `0` hidden.
       */
      _setPageLoc: function (page) {
        var data = this.state(),
          view = this.turn("view");

        if (page == view[0] || page == view[1]) {
          data.pageWrap[page].style({
            "z-index": data.totalPages,
            display: "",
          });
          return 1;
        } else if (
          (data.display == "single" && page == view[0] + 1) ||
          (data.display == "double" && page == view[0] - 2) ||
          page == view[1] + 2
        ) {
          data.pageWrap[page].style({
            "z-index": data.totalPages - 1,
            display: "",
          });
          return 2;
        } else {
          data.pageWrap[page].style({ "z-index": 0, display: "none" });
          return 0;
        }
      },
    },
    // Methods and properties for the flip page effect

    /**
     * Public and private methods that manage the physical flip effect for a single
     * page, including corner detection, fold geometry, shadows, transforms, and
     * pointer/touch event handling.
     *
     * Methods prefixed with `_` are private implementation details and cannot be
     * called through the external dispatcher.
     */
    flipMethods = {
      // Constructor

      /**
       * Initializes a turn book or flip page, depending on the method table currently dispatching.
       *
       * @param {Object=} opts Runtime options merged with defaults.
       * @returns {TurnDomCollection} The active collection for chaining.
       */
      init: function (opts) {
        if (opts.gradients) {
          opts.frontGradient = true;
          opts.backGradient = true;
        }

        this.state({ f: {} });
        this.flip("options", opts);

        flipMethods._addPageWrapper.call(this);

        return this;
      },

      /**
       * Merges flip-specific state into the current page.
       *
       * @param {Object} d State fragment to merge.
       * @returns {TurnDomCollection} The page collection.
       */
      setData: function (d) {
        var data = this.state();

        data.f = extendObject(data.f, d);

        return this;
      },

      /**
       * Gets or updates flip options.
       *
       * @param {Object=} opts Option overrides.
       * @returns {Object|TurnDomCollection} Options for reads; page collection for writes.
       */
      options: function (opts) {
        var data = this.state().f;

        if (opts) {
          flipMethods.setData.call(this, {
            opts: extendObject({}, data.opts || flipOptions, opts),
          });
          return this;
        } else return data.opts;
      },

      /**
       * Sets the flip wrapper z-index.
       *
       * @param {number|null} z Z-index value.
       * @returns {TurnDomCollection} The page collection.
       */
      z: function (z) {
        var data = this.state().f;
        data.opts["z-index"] = z;
        data.fwrapper.style({
          "z-index": z || parseInt(data.parent.style("z-index"), 10) || 0,
        });

        return this;
      },

      /**
       * Returns the corners allowed to start a flip.
       *
       * @returns {Array<string>} Corner identifiers.
       */
      _cAllowed: function () {
        return (
          corners[this.state().f.opts.corners] || this.state().f.opts.corners
        );
      },

      /**
       * Detects whether an input event is inside an active corner zone.
       *
       * @param {Event|Touch} e Input event or point.
       * @returns {Object|boolean} Corner point data, or false when inactive.
       */
      _cornerActivated: function (e) {
        if (e.originalEvent === undefined) {
          return false;
        }

        e = isTouch ? e.originalEvent.touches : [e];

        var data = this.state().f,
          pos = data.parent.offset(),
          width = this.width(),
          height = this.height(),
          c = {
            x: Math.max(0, e[0].pageX - pos.left),
            y: Math.max(0, e[0].pageY - pos.top),
          },
          csz = data.opts.cornerSize,
          allowedCorners = flipMethods._cAllowed.call(this);

        if (c.x <= 0 || c.y <= 0 || c.x >= width || c.y >= height) return false;

        if (c.y < csz) c.corner = "t";
        else if (c.y >= height - csz) c.corner = "b";
        else return false;

        if (c.x <= csz) c.corner += "l";
        else if (c.x >= width - csz) c.corner += "r";
        else return false;

        return arrayIndexOf(c.corner, allowedCorners) == -1 ? false : c;
      },

      /**
       * Returns a page corner point, optionally inset.
       *
       * @param {string} corner Corner identifier.
       * @param {number=} opts Inset distance.
       * @returns {{x:number,y:number}} Point.
       */
      _c: function (corner, opts) {
        opts = opts || 0;
        return {
          tl: point2D(opts, opts),
          tr: point2D(this.width() - opts, opts),
          bl: point2D(opts, this.height() - opts),
          br: point2D(this.width() - opts, this.height() - opts),
        }[corner];
      },

      /**
       * Returns the off-page destination point used to finish a turn.
       *
       * @param {string} corner Corner identifier.
       * @returns {{x:number,y:number}} Destination point.
       */
      _c2: function (corner) {
        return {
          tl: point2D(this.width() * 2, 0),
          tr: point2D(-this.width(), 0),
          bl: point2D(this.width() * 2, this.height()),
          br: point2D(-this.width(), this.height()),
        }[corner];
      },

      /**
       * Finds the page that should appear behind the folding sheet.
       *
       * @returns {TurnDomCollection|null|undefined} Folding page collection.
       */
      _foldingPage: function (corner) {
        var opts = this.state().f.opts;

        if (opts.folding) return opts.folding;
        else if (opts.turn) {
          var data = opts.turn.state();
          if (data.display == "single")
            return data.pageObjs[opts.next] ? data.pageObjs[0] : null;
          else return data.pageObjs[opts.next];
        }
      },

      /**
       * Ensures and reports whether the back-side shadow gradient is enabled.
       *
       * @returns {boolean} True when the back gradient should render.
       */
      _backGradient: function () {
        var data = this.state().f,
          turn = data.opts.turn,
          gradient =
            data.opts.backGradient &&
            (!turn ||
              turn.state().display == "single" ||
              (data.opts.page != 2 &&
                data.opts.page != turn.state().totalPages - 1));

        if (gradient && !data.bshadow)
          data.bshadow = createTurnDomCollection("<div/>", divAtt(0, 0, 1))
            .style({ position: "", width: this.width(), height: this.height() })
            .appendTo(data.parent);

        return gradient;
      },

      /**
       * Recomputes flip geometry for mounted pages after a size or position change.
       */
      resize: function (full) {
        var data = this.state().f,
          width = this.width(),
          height = this.height(),
          size = Math.round(
            Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)),
          );

        if (full) {
          data.wrapper.style({ width: size, height: size });
          data.fwrapper
            .style({ width: size, height: size })
            .children(":first-child")
            .style({ width: width, height: height });

          data.fpage.style({ width: height, height: width });

          if (data.opts.frontGradient)
            data.ashadow.style({ width: height, height: width });

          if (flipMethods._backGradient.call(this))
            data.bshadow.style({ width: width, height: height });
        }

        if (data.parent.matchesSelector(":visible")) {
          data.fwrapper.style({
            top: data.parent.offset().top,
            left: data.parent.offset().left,
          });

          if (data.opts.turn)
            data.fparent.style({
              top: -data.opts.turn.offset().top,
              left: -data.opts.turn.offset().left,
            });
        }

        this.flip("z", data.opts["z-index"]);
      },

      // Prepares the page by adding a general wrapper and another objects

      /**
       * Builds persistent wrapper elements required by the flip effect.
       */
      _addPageWrapper: function () {
        var att,
          data = this.state().f,
          parent = this.parent();

        if (!data.wrapper) {
          var left = this.style("left"),
            top = this.style("top"),
            width = this.width(),
            height = this.height(),
            size = Math.round(
              Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)),
            );

          data.parent = parent;
          data.fparent = data.opts.turn
            ? data.opts.turn.state().fparent
            : createTurnDomCollection("#turn-fwrappers");

          if (!data.fparent || !data.fparent.length) {
            var fparent = createTurnDomCollection("<div/>", {
              styles: { "pointer-events": "none" },
            }).hide();
            fparent.state().flips = 0;

            if (data.opts.turn) {
              fparent
                .style(
                  divAtt(
                    -data.opts.turn.offset().top,
                    -data.opts.turn.offset().left,
                    "auto",
                    "visible",
                  ).styles,
                )
                .appendTo(data.opts.turn);

              data.opts.turn.state().fparent = fparent;
            } else {
              fparent
                .style(divAtt(0, 0, "auto", "visible").styles)
                .attribute("id", "turn-fwrappers")
                .appendTo(createTurnDomCollection("body"));
            }

            data.fparent = fparent;
          }

          this.style({
            position: "absolute",
            top: 0,
            left: 0,
            bottom: "auto",
            right: "auto",
          });

          data.wrapper = createTurnDomCollection(
            "<div/>",
            divAtt(0, 0, this.style("z-index")),
          )
            .appendTo(parent)
            .prepend(this);

          data.fwrapper = createTurnDomCollection(
            "<div/>",
            divAtt(parent.offset().top, parent.offset().left),
          )
            .hide()
            .appendTo(data.fparent);

          data.fpage = createTurnDomCollection("<div/>", {
            styles: { cursor: "default" },
          }).appendTo(
            createTurnDomCollection(
              "<div/>",
              divAtt(0, 0, 0, "visible"),
            ).appendTo(data.fwrapper),
          );

          if (data.opts.frontGradient)
            data.ashadow = createTurnDomCollection(
              "<div/>",
              divAtt(0, 0, 1),
            ).appendTo(data.fpage);

          // Save data

          flipMethods.setData.call(this, data);

          // Set size
          flipMethods.resize.call(this, true);
        }
      },

      // Takes a 2P point from the screen and applies the transformation

      /**
       * Applies page-curl geometry and transforms for one pointer position.
       *
       * @param {{x:number,y:number,corner:string}} point Pointer/corner state.
       */
      _fold: function (point) {
        var that = this,
          a = 0,
          alpha = 0,
          beta,
          px,
          gradientEndPointA,
          gradientEndPointB,
          gradientStartV,
          gradientSize,
          gradientOpacity,
          mv = point2D(0, 0),
          df = point2D(0, 0),
          tr = point2D(0, 0),
          width = this.width(),
          height = this.height(),
          folding = flipMethods._foldingPage.call(this),
          tan = Math.tan(alpha),
          data = this.state().f,
          ac = data.opts.acceleration,
          h = data.wrapper.height(),
          o = flipMethods._c.call(this, point.corner),
          top = point.corner.substr(0, 1) == "t",
          left = point.corner.substr(1, 1) == "l",
          compute = function () {
            var rel = point2D(
                o.x ? o.x - point.x : point.x,
                o.y ? o.y - point.y : point.y,
              ),
              tan = Math.atan2(rel.y, rel.x),
              middle;

            alpha = A90 - tan;
            a = deg(alpha);
            middle = point2D(
              left ? width - rel.x / 2 : point.x + rel.x / 2,
              rel.y / 2,
            );

            var gamma = alpha - Math.atan2(middle.y, middle.x),
              distance = Math.max(
                0,
                Math.sin(gamma) *
                  Math.sqrt(Math.pow(middle.x, 2) + Math.pow(middle.y, 2)),
              );

            tr = point2D(
              distance * Math.sin(alpha),
              distance * Math.cos(alpha),
            );

            if (alpha > A90) {
              tr.x = tr.x + Math.abs(tr.y * Math.tan(tan));
              tr.y = 0;

              if (Math.round(tr.x * Math.tan(PI - alpha)) < height) {
                point.y = Math.sqrt(Math.pow(height, 2) + 2 * middle.x * rel.x);
                if (top) point.y = height - point.y;
                return compute();
              }
            }

            if (alpha > A90) {
              var beta = PI - alpha,
                dd = h - height / Math.sin(beta);
              mv = point2D(
                Math.round(dd * Math.cos(beta)),
                Math.round(dd * Math.sin(beta)),
              );
              if (left) mv.x = -mv.x;
              if (top) mv.y = -mv.y;
            }

            px = Math.round(tr.y / Math.tan(alpha) + tr.x);

            var side = width - px,
              sideX = side * Math.cos(alpha * 2),
              sideY = side * Math.sin(alpha * 2);
            df = point2D(
              Math.round(left ? side - sideX : px + sideX),
              Math.round(top ? sideY : height - sideY),
            );

            // GRADIENTS

            gradientSize = side * Math.sin(alpha);
            var endingPoint = flipMethods._c2.call(that, point.corner),
              far = Math.sqrt(
                Math.pow(endingPoint.x - point.x, 2) +
                  Math.pow(endingPoint.y - point.y, 2),
              );

            gradientOpacity = far < width ? far / width : 1;

            if (data.opts.frontGradient) {
              gradientStartV =
                gradientSize > 100 ? (gradientSize - 100) / gradientSize : 0;
              gradientEndPointA = point2D(
                ((gradientSize * Math.sin(A90 - alpha)) / height) * 100,
                ((gradientSize * Math.cos(A90 - alpha)) / width) * 100,
              );

              if (top) gradientEndPointA.y = 100 - gradientEndPointA.y;
              if (left) gradientEndPointA.x = 100 - gradientEndPointA.x;
            }

            if (flipMethods._backGradient.call(that)) {
              gradientEndPointB = point2D(
                ((gradientSize * Math.sin(alpha)) / width) * 100,
                ((gradientSize * Math.cos(alpha)) / height) * 100,
              );
              if (!left) gradientEndPointB.x = 100 - gradientEndPointB.x;
              if (!top) gradientEndPointB.y = 100 - gradientEndPointB.y;
            }
            //

            tr.x = Math.round(tr.x);
            tr.y = Math.round(tr.y);

            return true;
          },
          transform = function (tr, c, x, a) {
            var f = ["0", "auto"],
              mvW = ((width - h) * x[0]) / 100,
              mvH = ((height - h) * x[1]) / 100,
              v = {
                left: f[c[0]],
                top: f[c[1]],
                right: f[c[2]],
                bottom: f[c[3]],
              },
              aliasingFk = a != 90 && a != -90 ? (left ? -1 : 1) : 0;

            x = x[0] + "% " + x[1] + "%";

            that
              .style(v)
              .transform(rotate(a) + translate(tr.x + aliasingFk, tr.y, ac), x);

            data.fpage.parent().style(v);
            data.wrapper.transform(
              translate(-tr.x + mvW - aliasingFk, -tr.y + mvH, ac) + rotate(-a),
              x,
            );

            data.fwrapper.transform(
              translate(-tr.x + mv.x + mvW, -tr.y + mv.y + mvH, ac) +
                rotate(-a),
              x,
            );
            data.fpage
              .parent()
              .transform(
                rotate(a) +
                  translate(tr.x + df.x - mv.x, tr.y + df.y - mv.y, ac),
                x,
              );

            if (data.opts.frontGradient)
              gradient(
                data.ashadow,
                point2D(left ? 100 : 0, top ? 100 : 0),
                point2D(gradientEndPointA.x, gradientEndPointA.y),
                [
                  [gradientStartV, "rgba(0,0,0,0)"],
                  [
                    (1 - gradientStartV) * 0.8 + gradientStartV,
                    "rgba(0,0,0," + 0.2 * gradientOpacity + ")",
                  ],
                  [1, "rgba(255,255,255," + 0.2 * gradientOpacity + ")"],
                ],
                3,
                alpha,
              );

            if (flipMethods._backGradient.call(that))
              gradient(
                data.bshadow,
                point2D(left ? 0 : 100, top ? 0 : 100),
                point2D(gradientEndPointB.x, gradientEndPointB.y),
                [
                  [0.8, "rgba(0,0,0,0)"],
                  [1, "rgba(0,0,0," + 0.3 * gradientOpacity + ")"],
                  [1, "rgba(0,0,0,0)"],
                ],
                3,
              );
          };

        switch (point.corner) {
          case "tl":
            point.x = Math.max(point.x, 1);
            compute();
            transform(tr, [1, 0, 0, 1], [100, 0], a);
            data.fpage.transform(
              translate(-height, -width, ac) + rotate(90 - a * 2),
              "100% 100%",
            );
            folding.transform(rotate(90) + translate(0, -height, ac), "0% 0%");
            break;
          case "tr":
            point.x = Math.min(point.x, width - 1);
            compute();
            transform(point2D(-tr.x, tr.y), [0, 0, 0, 1], [0, 0], -a);
            data.fpage.transform(
              translate(0, -width, ac) + rotate(-90 + a * 2),
              "0% 100%",
            );
            folding.transform(rotate(270) + translate(-width, 0, ac), "0% 0%");
            break;
          case "bl":
            point.x = Math.max(point.x, 1);
            compute();
            transform(point2D(tr.x, -tr.y), [1, 1, 0, 0], [100, 100], -a);
            data.fpage.transform(
              translate(-height, 0, ac) + rotate(-90 + a * 2),
              "100% 0%",
            );
            folding.transform(rotate(270) + translate(-width, 0, ac), "0% 0%");
            break;
          case "br":
            point.x = Math.min(point.x, width - 1);
            compute();
            transform(point2D(-tr.x, -tr.y), [0, 1, 1, 0], [0, 100], a);
            data.fpage.transform(rotate(90 - a * 2), "0% 0%");
            folding.transform(rotate(90) + translate(0, -height, ac), "0% 0%");

            break;
        }

        data.point = point;
      },

      /**
       * Moves the backing page into or out of the temporary flip wrapper.
       *
       * @param {boolean} bool True to move into the flip wrapper; false to restore.
       */
      _moveFoldingPage: function (bool) {
        var data = this.state().f,
          folding = flipMethods._foldingPage.call(this);

        if (folding) {
          if (bool) {
            if (!data.fpage.children()[data.ashadow ? "1" : "0"]) {
              flipMethods.setData.call(this, { backParent: folding.parent() });
              data.fpage.prepend(folding);
            }
          } else {
            if (data.backParent) data.backParent.prepend(folding);
          }
        }
      },

      /**
       * Displays and optionally animates the folded page at a corner point.
       *
       * @param {{x:number,y:number,corner:string}} c Corner point.
       * @param {boolean=} animate Whether to animate into position.
       * @returns {boolean} True when a folding page is shown.
       */
      _showFoldedPage: function (c, animate) {
        var folding = flipMethods._foldingPage.call(this),
          dd = this.state(),
          data = dd.f;

        if (!data.point || data.point.corner != c.corner) {
          var event = createTurnEvent("start");
          this.dispatch(event, [data.opts, c.corner]);

          if (event.isDefaultPrevented()) return false;
        }

        if (folding) {
          if (animate) {
            var that = this,
              point =
                data.point && data.point.corner == c.corner
                  ? data.point
                  : flipMethods._c.call(this, c.corner, 1);

            this.animatef({
              from: [point.x, point.y],
              to: [c.x, c.y],
              duration: 500,
              frame: function (v) {
                c.x = Math.round(v[0]);
                c.y = Math.round(v[1]);
                flipMethods._fold.call(that, c);
              },
            });
          } else {
            flipMethods._fold.call(this, c);
            if (dd.effect && !dd.effect.turning) this.animatef(false);
          }

          if (!data.fwrapper.matchesSelector(":visible")) {
            data.fparent.show().state().flips++;
            flipMethods._moveFoldingPage.call(this, true);
            data.fwrapper.show();

            if (data.bshadow) data.bshadow.show();
          }

          return true;
        }

        return false;
      },

      /**
       * Hides the active folded page and restores transforms.
       *
       * @returns {TurnDomCollection} The page collection.
       */
      hide: function () {
        var data = this.state().f,
          folding = flipMethods._foldingPage.call(this);

        if (--data.fparent.state().flips === 0) data.fparent.hide();

        this.style({
          left: 0,
          top: 0,
          right: "auto",
          bottom: "auto",
        }).transform("", "0% 100%");

        data.wrapper.transform("", "0% 100%");

        data.fwrapper.hide();

        if (data.bshadow) data.bshadow.hide();

        folding.transform("", "0% 0%");

        return this;
      },

      /**
       * Animates or immediately hides the folded page.
       *
       * @param {boolean=} animate Whether to animate the hide.
       */
      hideFoldedPage: function (animate) {
        var data = this.state().f;

        if (!data.point) return;

        var that = this,
          p1 = data.point,
          hide = function () {
            data.point = null;
            that.flip("hide");
            that.dispatch("end", [false]);
          };

        if (animate) {
          var p4 = flipMethods._c.call(this, p1.corner),
            top = p1.corner.substr(0, 1) == "t",
            delta = top
              ? Math.min(0, p1.y - p4.y) / 2
              : Math.max(0, p1.y - p4.y) / 2,
            p2 = point2D(p1.x, p1.y + delta),
            p3 = point2D(p4.x, p4.y - delta);

          this.animatef({
            from: 0,
            to: 1,
            frame: function (v) {
              var np = bezier(p1, p2, p3, p4, v);
              p1.x = np.x;
              p1.y = np.y;
              flipMethods._fold.call(that, p1);
            },
            complete: hide,
            duration: 800,
            hiding: true,
          });
        } else {
          this.animatef(false);
          hide();
        }
      },

      /**
       * Animates the current page to a completed turn.
       *
       * @param {string=} corner Optional corner identifier.
       */
      turnPage: function (corner) {
        var that = this,
          data = this.state().f;

        corner = {
          corner: data.corner
            ? data.corner.corner
            : corner || flipMethods._cAllowed.call(this)[0],
        };

        var p1 =
            data.point ||
            flipMethods._c.call(
              this,
              corner.corner,
              data.opts.turn ? data.opts.turn.state().opts.elevation : 0,
            ),
          p4 = flipMethods._c2.call(this, corner.corner);

        this.dispatch("flip").animatef({
          from: 0,
          to: 1,
          frame: function (v) {
            var np = bezier(p1, p1, p4, p4, v);
            corner.x = np.x;
            corner.y = np.y;
            flipMethods._showFoldedPage.call(that, corner);
          },

          complete: function () {
            that.dispatch("end", [true]);
          },
          duration: data.opts.duration,
          turning: true,
        });

        data.corner = null;
      },

      /**
       * Reports whether the current flip has any animation effect active.
       *
       * @returns {boolean} True when an effect exists.
       */
      moving: function () {
        return "effect" in this.state();
      },

      /**
       * Reports whether the current flip is actively turning a page.
       *
       * @returns {boolean} True during committed turn animation.
       */
      isTurning: function () {
        return this.flip("moving") && this.state().effect.turning;
      },

      /**
       * Processes pointer/touch start events for a flip.
       *
       * @param {Event} e Input event.
       * @returns {boolean|undefined} False when the event is captured.
       */
      _eventStart: function (e) {
        var data = this.state().f;

        if (!data.disabled && !this.flip("isTurning")) {
          data.corner = flipMethods._cornerActivated.call(this, e);
          if (data.corner && flipMethods._foldingPage.call(this, data.corner)) {
            flipMethods._moveFoldingPage.call(this, true);
            this.dispatch("pressed", [data.point]);
            return false;
          } else data.corner = null;
        }
      },

      /**
       * Processes pointer/touch movement for active drags and hover previews.
       *
       * @param {Event} e Input event.
       */
      _eventMove: function (e) {
        var data = this.state().f;

        if (!data.disabled) {
          e = isTouch ? e.originalEvent.touches : [e];

          if (data.corner) {
            var pos = data.parent.offset();

            data.corner.x = e[0].pageX - pos.left;
            data.corner.y = e[0].pageY - pos.top;

            flipMethods._showFoldedPage.call(this, data.corner);
          } else if (!this.state().effect && this.matchesSelector(":visible")) {
            // roll over

            var corner = flipMethods._cornerActivated.call(this, e[0]);
            if (corner) {
              var origin = flipMethods._c.call(
                this,
                corner.corner,
                data.opts.cornerSize / 2,
              );
              corner.x = origin.x;
              corner.y = origin.y;
              flipMethods._showFoldedPage.call(this, corner, true);
            } else flipMethods.hideFoldedPage.call(this, true);
          }
        }
      },

      /**
       * Processes pointer/touch end events and releases active folds.
       */
      _eventEnd: function () {
        var data = this.state().f;

        if (!data.disabled && data.point) {
          var event = createTurnEvent("released");
          this.dispatch(event, [data.point]);
          if (!event.isDefaultPrevented())
            flipMethods.hideFoldedPage.call(this, true);
        }

        data.corner = null;
      },

      /**
       * Enables or disables turn/flip interactions.
       *
       * @param {boolean=} bool Disabled state.
       * @returns {TurnDomCollection} The active collection.
       */
      disable: function (disable) {
        flipMethods.setData.call(this, { disabled: disable });
        return this;
      },
    },
    /**
     * Dispatches public method calls to a method table.
     *
     * Object or missing first arguments initialize the target; string first arguments
     * call named public methods. Private methods prefixed with `_` are intentionally
     * blocked from the external dispatcher.
     *
     * @param {TurnDomCollection} that Collection receiving the method call.
     * @param {Object<string, Function>} methods Method table.
     * @param {IArguments} args Original arguments object.
     * @returns {*} Method return value.
     */
    cla = function (that, methods, args) {
      if (!args[0] || typeof args[0] == "object")
        return methods.init.apply(that, args);
      else if (methods[args[0]] && args[0].toString().substr(0, 1) != "_")
        return methods[args[0]].apply(
          that,
          Array.prototype.slice.call(args, 1),
        );
      else throw args[0] + " is an invalid value";
    };

  /**
   * Public API methods mixed into `TurnDomCollection` after the turn and flip
   * method tables are defined.
   */
  extendObject(TurnDomCollection.prototype, {
    /**
     * Dispatches the public flip API for this collection.
     *
     * @param {string|Object=} req Method name or initialization options.
     * @param {*=} opts Optional method argument.
     * @returns {*} Flip method result.
     */
    flip: function (req, opts) {
      return cla(this, flipMethods, arguments);
    },

    /**
     * Dispatches the public turn API for this collection.
     *
     * @param {string|Object=} req Method name or initialization options.
     * @returns {*} Turn method result.
     */
    turn: function (req) {
      return cla(this, turnMethods, arguments);
    },

    /**
     * Applies a vendor-prefixed CSS transform and optional transform origin.
     *
     * @param {string} transform Transform value.
     * @param {string=} origin Transform origin.
     * @returns {TurnDomCollection} This collection.
     */
    transform: function (transform, origin) {
      var properties = {};

      if (origin) properties[vendor + "transform-origin"] = origin;

      properties[vendor + "transform"] = transform;

      return this.style(properties);
    },

    /**
     * Runs or cancels a frame-based numeric animation used by page curls.
     *
     * @param {Object|boolean} point Animation descriptor, or falsey to cancel.
     */
    animatef: function (point) {
      var data = this.state();

      if (data.effect) clearInterval(data.effect.handle);

      if (point) {
        if (!point.to.length) point.to = [point.to];
        if (!point.from.length) point.from = [point.from];
        if (!point.easing)
          point.easing = function (x, t, b, c, data) {
            return c * Math.sqrt(1 - (t = t / data - 1) * t) + b;
          };

        var j,
          diff = [],
          len = point.to.length,
          that = this,
          fps = point.fps || 30,
          time = -fps,
          f = function () {
            var j,
              v = [];
            time = Math.min(point.duration, time + fps);

            for (j = 0; j < len; j++)
              v.push(
                point.easing(1, time, point.from[j], diff[j], point.duration),
              );

            point.frame(len == 1 ? v[0] : v);

            if (time == point.duration) {
              clearInterval(data.effect.handle);
              delete data["effect"];
              that.state(data);
              if (point.complete) point.complete();
            }
          };

        for (j = 0; j < len; j++) diff.push(point.to[j] - point.from[j]);

        data.effect = point;
        data.effect.handle = setInterval(f, fps);
        this.state(data);
        f();
      } else {
        delete data["effect"];
      }
    },
  });

  /**
   * Indicates whether touch events are available in the current browser.
   *
   * @type {boolean}
   */
  createTurnDomCollection.isTouch = isTouch;
  /**
   * Public factory for callers that want collection-style access without jQuery.
   *
   * @type {Function}
   */
  window.turnDom = createTurnDomCollection;
  /**
   * Native-element convenience wrapper for the public turn API.
   *
   * @returns {*} Return value from the dispatched turn method.
   */
  Element.prototype.turn = function () {
    return createTurnDomCollection(this).turn.apply(
      createTurnDomCollection(this),
      arguments,
    );
  };
  /**
   * Native-element convenience wrapper for the public flip API.
   *
   * @returns {*} Return value from the dispatched flip method.
   */
  Element.prototype.flip = function () {
    return createTurnDomCollection(this).flip.apply(
      createTurnDomCollection(this),
      arguments,
    );
  };
})();
