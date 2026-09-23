<template>
  <div style="position: relative">
    <div
      ref="triggerElement"
      @click="handleClick"
      @mouseenter="handleHoverIn"
      @mouseleave="handleHoverOut"
      @contextmenu.prevent="handleRightClick"
      :data-trigger-uid="id"
    >
      <wwLayout class="layout content-layout" path="triggerLayout" />
    </div>
    <teleport :to="appDiv" v-if="!delayedIsClosed">
      <div
        :style="style"
        class="dropdown"
        ww-responsive="dropdown"
        ref="dropdownElement"
        :data-dropdown-uid="id"
      >
        <div
          @mouseenter="handleHoverIn"
          @mouseleave="handleHoverOut"
          @click="handleContentClick"
        >
          <Transition :name="content?.animated ? 'slide' : ''">
            <wwLayout v-if="delayedIsOpen" path="dropdownLayout" />
          </Transition>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import {
  ref,
  useTemplateRef,
  onUnmounted,
  computed,
  watch,
  nextTick,
  onMounted,
  inject,
  provide,
} from "vue";
export default {
  props: {
    uid: { type: String, required: true },
    content: { type: Object, required: true },
    wwFrontState: { type: Object, required: true },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  data() {
    return {
      dropdownSize: 0,
    };
  },
  setup(props) {
    const appDiv = wwLib.getFrontDocument().querySelector("#app");
    const isEditing = computed(() => {
      /* wwEditor:start */
      return props.wwEditorState?.isEditing;
      /* wwEditor:end */
      // eslint-disable-next-line no-unreachable
      return false;
    });
    const triggerElementRef = useTemplateRef("triggerElement");
    const dropdownElementRef = useTemplateRef("dropdownElement");

    const id = wwLib.wwUtils.getUid();
    const registerAsChild = inject("__ww-dropdown_registerAsChild", () => {});
    const unregisterAsChild = inject(
      "__ww-dropdown_unregisterAsChild",
      () => {}
    );
    const ids = [id];

    // Add provide for local context
    const localContext = ref({
      data: {
        dropdown: {
          utils: {
            isOpen: false,
          },
        },
      },
    });

    provide("__ww-dropdown_localContext", localContext);

    provide("__ww-dropdown_registerAsChild", (childId) => {
      if (!ids.includes(childId)) {
        ids.push(childId);
      }
      registerAsChild(childId);
    });
    provide("__ww-dropdown_unregisterAsChild", (childId) => {
      const index = ids.indexOf(childId);
      if (index !== -1) {
        ids.splice(index, 1);
      }
      unregisterAsChild(childId);
    });
    onMounted(() => {
      registerAsChild(id);
    });
    onUnmounted(() => {
      unregisterAsChild(id);
    });

    // The editor runs installed components in another realm than the canvas, and an
    // observer from that realm is not guaranteed to be notified of canvas layout.
    function createResizeObserver(callback) {
      const FrontResizeObserver = wwLib.getFrontWindow()?.ResizeObserver;
      return FrontResizeObserver ? new FrontResizeObserver(callback) : null;
    }

    const triggerBox = ref({});
    const synchronizeTriggerBox = () => {
      if (!triggerElementRef?.value) return;
      const box = triggerElementRef.value.getBoundingClientRect();
      triggerBox.value = {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };

    // With openAtCursor the panel anchors to a zero-size box at the pointer instead
    // of the trigger's box. The pointer is stored relative to the trigger so the
    // panel follows the trigger on scroll like it does without the option.
    const cursorOffset = ref(null);
    const openAtCursor = computed(
      () =>
        !!props.content?.openAtCursor && props.content?.triggerType !== "hover"
    );
    function setCursorAnchor(event) {
      synchronizeTriggerBox();
      const box = triggerBox.value;
      // A click from the keyboard (detail 0) has no meaningful pointer position.
      const hasPointer =
        typeof event?.clientX === "number" &&
        !(event.type === "click" && event.detail === 0);
      cursorOffset.value =
        hasPointer && typeof box?.left === "number"
          ? { x: event.clientX - box.left, y: event.clientY - box.top }
          : null;
    }
    const anchorBox = computed(() => {
      const box = triggerBox.value ?? {};
      const offset = cursorOffset.value;
      if (!openAtCursor.value || !offset) return box;
      const x = (box.left ?? 0) + offset.x;
      const y = (box.top ?? 0) + offset.y;
      return { left: x, right: x, top: y, bottom: y, width: 0, height: 0 };
    });

    // The click that opens the dropdown keeps propagating up to this document-level
    // handler. Identifying "my own trigger" by uid cannot work here: WeWeb mounts the
    // teleported dropdown as a component instance separate from the trigger, so each
    // gets its own `wwLib.wwUtils.getUid()` and the `ids.includes(...)` checks below
    // never match — measured on staging, trigger e9ddd0a7 opening dropdown d48e8923.
    // The dropdown then closed itself on the very click that opened it. Comparing the
    // event object instead is immune to how many instances get created.
    // In the editor this was masked: `isDisplayed` also honours
    // `forceDisplayEditor && isEditing`, so the dropdown stayed visible after
    // `isOpened` had already flipped back to false.
    const openingEvent = ref(null);

    function onWindowClick(event) {
      if (event === openingEvent.value) return;
      if (props.content?.disabled) return;
      if (
        props.content?.triggerType === "hover" &&
        props.wwFrontState?.screenSize === "default"
      )
        return;
      const triggerParent = event.target?.closest?.("[data-trigger-uid]");
      if (triggerParent) {
        const triggerUid = triggerParent.getAttribute("data-trigger-uid");
        if (ids.includes(triggerUid)) return;
      }
      const dropdownParent = event.target?.closest?.("[data-dropdown-uid]");
      if (dropdownParent) {
        const dropdownUid = dropdownParent.getAttribute("data-dropdown-uid");
        if (ids.includes(dropdownUid)) return;
      }
      isOpened.value = false;
    }

    const isOpened = ref(false);

    function onKeydown(event) {
      if (event?.key !== "Escape") return;
      if (!(props.content?.closeOnEscape ?? true)) return;
      isOpened.value = false;
    }

    // Local variable data for dropdown state - use ref to maintain reactivity
    const dropdownLocalData = ref({
      isOpen: isOpened.value,
      trigger: {
        type: props.content?.triggerType || "click",
        disabled: props.content?.disabled || false,
      },
      position: {
        placement: props.content?.position || "bottom",
        alignment: props.content?.alignment || "start",
        offsetX: props.content?.offsetX || "0px",
        offsetY: props.content?.offsetY || "0px",
      },
      state: {
        isDisplayed:
          isOpened.value ||
          (props.content?.forceDisplayEditor && isEditing.value),
        isAnimated: props.content?.animated || false,
      },
    });

    // Markdown documentation for local variables
    const dropdownMarkdown = `### Dropdown Local Information

#### isOpen
Boolean indicating whether the dropdown is currently open or closed.

#### trigger
Information about the dropdown trigger:
- \`type\`: Trigger type ('click', 'hover', or 'right-click')
- \`disabled\`: Boolean indicating if dropdown is disabled

#### position
Current positioning configuration:
- \`placement\`: Position relative to trigger ('top', 'right', 'bottom', 'left')
- \`alignment\`: Alignment along position axis ('start', 'center', 'end')
- \`offsetX\`: Horizontal offset (e.g., '10px', '5%')
- \`offsetY\`: Vertical offset (e.g., '8px', '2%')

#### state
Current dropdown state:
- \`isDisplayed\`: Whether dropdown content is being displayed (including editor force display)
- \`isAnimated\`: Whether animations are enabled

**Usage Example:**
\`\`\`
context.local.data?.['dropdown']?.['isOpen']
context.local.data?.['dropdown']?.['trigger']?.['type']
context.local.data?.['dropdown']?.['position']?.['placement']
\`\`\``;

    // Register local context
    wwLib.wwElement.useRegisterElementLocalContext(
      "dropdown",
      dropdownLocalData,
      {},
      dropdownMarkdown
    );

    // Watch isOpened and update both nested context and local data
    watch(
      isOpened,
      (newValue) => {
        localContext.value.data.dropdown.utils.isOpen = newValue;

        // Update local data reactively
        dropdownLocalData.value.isOpen = newValue;
        dropdownLocalData.value.state.isDisplayed =
          newValue || (props.content?.forceDisplayEditor && isEditing.value);
      },
      { immediate: true }
    );

    // Watch content properties and update local data
    watch(
      () => [
        props.content?.triggerType,
        props.content?.disabled,
        props.content?.position,
        props.content?.alignment,
        props.content?.offsetX,
        props.content?.offsetY,
        props.content?.animated,
      ],
      () => {
        dropdownLocalData.value.trigger = {
          type: props.content?.triggerType || "click",
          disabled: props.content?.disabled || false,
        };
        dropdownLocalData.value.position = {
          placement: props.content?.position || "bottom",
          alignment: props.content?.alignment || "start",
          offsetX: props.content?.offsetX || "0px",
          offsetY: props.content?.offsetY || "0px",
        };
        dropdownLocalData.value.state.isAnimated =
          props.content?.animated || false;
      },
      { deep: true, immediate: true }
    );

    const isDisplayed = computed(() => {
      return (
        isOpened.value || (props.content?.forceDisplayEditor && isEditing.value)
      );
    });
    const delayedIsOpen = ref(isDisplayed.value);
    const delayedIsClosed = ref(!isDisplayed.value);
    const timeoutId = ref(null);

    // keepInViewport: once the panel is laid out, measure it, flip it to the
    // opposite side when the configured one lacks room, then shift it along both
    // axes to stay inside the viewport. Every pass recomputes both from the
    // configured position, so repeated passes converge instead of drifting.
    const VIEWPORT_MARGIN = 8;
    const OPPOSITE_SIDE = {
      top: "bottom",
      bottom: "top",
      left: "right",
      right: "left",
    };
    const keepInViewport = computed(
      () => props.content?.keepInViewport ?? true
    );
    const preferredPlacement = computed(() =>
      OPPOSITE_SIDE[props.content?.position] ? props.content?.position : "bottom"
    );
    const flippedPlacement = ref(null);
    const viewportShift = ref({ x: 0, y: 0 });
    const placement = computed(
      () => flippedPlacement.value ?? preferredPlacement.value
    );

    function resetViewportFit() {
      const shift = viewportShift.value;
      if (flippedPlacement.value === null && !shift.x && !shift.y) return;
      flippedPlacement.value = null;
      viewportShift.value = { x: 0, y: 0 };
    }

    function clampDelta(start, end, max) {
      let delta = 0;
      if (end > max - VIEWPORT_MARGIN) delta = max - VIEWPORT_MARGIN - end;
      if (start + delta < VIEWPORT_MARGIN) delta = VIEWPORT_MARGIN - start;
      return Math.round(delta);
    }

    function fitToViewport(isRetry = false) {
      if (!keepInViewport.value) {
        resetViewportFit();
        return;
      }
      const el = dropdownElementRef.value;
      const anchor = anchorBox.value;
      const root = wwLib.getFrontDocument()?.documentElement;
      if (!el || !root || !isDisplayed.value) return;
      if (typeof anchor?.top !== "number") return;
      const rect = el.getBoundingClientRect();
      if (!rect.width && !rect.height) return;

      const vw = root.clientWidth;
      const vh = root.clientHeight;
      // The anchor scrolled out of view: let the panel leave with it instead of
      // flipping and pinning it to the viewport edge over unrelated content.
      if (
        anchor.bottom < 0 ||
        anchor.top > vh ||
        anchor.right < 0 ||
        anchor.left > vw
      ) {
        resetViewportFit();
        return;
      }
      const shift = viewportShift.value;
      const left = rect.left - shift.x;
      const top = rect.top - shift.y;
      const right = left + rect.width;
      const bottom = top + rect.height;

      if (!isRetry) {
        const side = placement.value;
        const gap = {
          bottom: top - anchor.bottom,
          top: anchor.top - bottom,
          right: left - anchor.right,
          left: anchor.left - right,
        }[side];
        const size =
          side === "top" || side === "bottom" ? rect.height : rect.width;
        const needed = size + Math.max(gap, 0) + VIEWPORT_MARGIN;
        const room = {
          bottom: vh - anchor.bottom,
          top: anchor.top,
          right: vw - anchor.right,
          left: anchor.left,
        };
        const preferred = preferredPlacement.value;
        const opposite = OPPOSITE_SIDE[preferred];
        const next =
          needed <= room[preferred] || room[preferred] >= room[opposite]
            ? preferred
            : opposite;
        if (next !== side) {
          flippedPlacement.value = next === preferred ? null : next;
          viewportShift.value = { x: 0, y: 0 };
          // Re-measure once the flipped position is rendered, before paint.
          nextTick(() => fitToViewport(true));
          return;
        }
      }

      const x = clampDelta(left, right, vw);
      const y = clampDelta(top, bottom, vh);
      if (x !== shift.x || y !== shift.y) viewportShift.value = { x, y };
    }

    // Fires on first layout and whenever the panel content changes size.
    let panelResizeObserver = null;
    watch(dropdownElementRef, (el) => {
      panelResizeObserver?.disconnect();
      panelResizeObserver = null;
      if (!el) {
        resetViewportFit();
        return;
      }
      panelResizeObserver = createResizeObserver(() => fitToViewport());
      panelResizeObserver?.observe(el);
    });
    // Anchor moves on scroll / resize: measure after the new position rendered.
    watch(anchorBox, () => fitToViewport(), { flush: "post" });
    watch(
      () => [
        props.content?.keepInViewport,
        props.content?.position,
        props.content?.alignment,
        props.content?.offsetX,
        props.content?.offsetY,
      ],
      () => {
        resetViewportFit();
        nextTick(() => fitToViewport());
      }
    );

    let resizeObserver = null;
    let scrollableParents = [];

    function setScrollableParents(element) {
      scrollableParents = [];
      let p = element?.parentNode;
      while (p && p !== wwLib.getFrontDocument().body) {
        const s = wwLib.getFrontWindow().getComputedStyle(p);
        if (
          /(auto|scroll|overlay)/.test(s.overflow + s.overflowY + s.overflowX)
        )
          scrollableParents.push(p);
        p = p.parentNode;
      }
      scrollableParents.push(wwLib.getFrontWindow());
    }

    function startPositioningDropdown() {
      synchronizeTriggerBox();
      wwLib.getFrontDocument().addEventListener("click", onWindowClick);
      // A right-click is not a click: without this, right-clicking another
      // right-click dropdown's trigger opened it and left this one open too.
      wwLib.getFrontDocument().addEventListener("contextmenu", onWindowClick);
      wwLib.getFrontDocument().addEventListener("keydown", onKeydown);
      resizeObserver = createResizeObserver((entries) => {
        const entry = entries?.[0];
        if (!entry) return;
        triggerBox.value.width = entry.contentRect.width;
        triggerBox.value.height = entry.contentRect.height;
      });
      if (triggerElementRef.value) resizeObserver?.observe(triggerElementRef.value);
      if (triggerElementRef.value) setScrollableParents(triggerElementRef.value);
      scrollableParents.forEach((p) => {
        p.addEventListener("scroll", synchronizeTriggerBox, { passive: true });
        wwLib
          .getFrontWindow()
          .addEventListener("resize", synchronizeTriggerBox);
      });
    }

    function stopPositioningDropdown() {
      wwLib.getFrontDocument().removeEventListener("click", onWindowClick);
      wwLib
        .getFrontDocument()
        .removeEventListener("contextmenu", onWindowClick);
      wwLib.getFrontDocument().removeEventListener("keydown", onKeydown);
      resizeObserver?.disconnect();
      scrollableParents.forEach((p) => {
        p.removeEventListener("scroll", synchronizeTriggerBox);
        wwLib
          .getFrontWindow()
          .removeEventListener("resize", synchronizeTriggerBox);
      });
      scrollableParents = [];
    }

    watch(isDisplayed, (isDisplayed) => {
      if (isDisplayed) {
        startPositioningDropdown();
        delayedIsClosed.value = false;
        nextTick(() => {
          delayedIsOpen.value = true;
        });
      } else {
        stopPositioningDropdown();
        delayedIsOpen.value = false;
        nextTick(() => {
          setTimeout(() => {
            delayedIsClosed.value = true;
          }, 250);
        });
      }
    });

    onMounted(() => {
      if (isDisplayed.value) {
        startPositioningDropdown();
      }
    });

    onUnmounted(() => {
      stopPositioningDropdown();
      panelResizeObserver?.disconnect();
      clearTimeout(timeoutId.value);
    });

    watch(
      () => props.content?.triggerType,
      (newValue, oldValue) => {
        if (newValue === oldValue) return;
        isOpened.value = false;
        clearTimeout(timeoutId.value);
      }
    );

    return {
      appDiv,
      synchronizeTriggerBox,
      triggerBox,
      anchorBox,
      placement,
      viewportShift,
      openAtCursor,
      setCursorAnchor,
      isOpened,
      timeoutId,
      isEditing,
      isDisplayed,
      delayedIsClosed,
      delayedIsOpen,
      id,
      localContext,
      openingEvent,
    };
  },
  computed: {
    // On smaller breakpoints a plain click also opens hover and right-click
    // dropdowns, since touch screens have neither. Right-click mode can opt out.
    opensOnSmallScreenClick() {
      if (this.wwFrontState?.screenSize === "default" || this.isEditing)
        return false;
      if (this.content?.triggerType !== "right-click") return true;
      return this.content?.smallScreenClickFallback ?? true;
    },
    style() {
      const style = {};
      const position = this.placement;
      const alignment = this.content?.alignment;

      const offsetX = this.content?.offsetX ?? "0px";
      const offsetY = this.content?.offsetY ?? "0px";

      switch (position) {
        case "top":
          style[
            "bottom"
          ] = `calc(100% - ${this.anchorBox.bottom}px + ${this.anchorBox.height}px + ${offsetY})`;
          break;
        case "bottom":
          style[
            "top"
          ] = `calc(${this.anchorBox.top}px + ${this.anchorBox.height}px + ${offsetY})`;
          break;
        case "left":
          style[
            "right"
          ] = `calc(100% - ${this.anchorBox.right}px + ${this.anchorBox.width}px + ${offsetX})`;
          break;
        case "right":
          style[
            "left"
          ] = `calc(${this.anchorBox.left}px + ${this.anchorBox.width}px + ${offsetX})`;
          break;
      }

      if (this.content?.animated) {
        switch (position) {
          case "top":
            style["--slideOriginY"] = offsetY;
            break;
          case "bottom":
            style["--slideOriginY"] = `calc(-1 * ${offsetY})`;
            style["--slideOriginX"] = "0px";
            break;
          case "left":
            style["--slideOriginX"] = offsetX;
            style["--slideOriginY"] = "0px";
            break;
          case "right":
            style["--slideOriginX"] = `calc(-1 * ${offsetX})`;
            style["--slideOriginY"] = "0px";
            break;
        }
      }

      switch (alignment) {
        case "start":
          if (position === "top" || position === "bottom") {
            if (this.content?.animated) {
              style["--transformOrigin"] =
                this.getOppositeSide(position) + " left";
            }
            style["left"] = `calc(${offsetX} + ${this.anchorBox.left}px)`;
            style["--slideOriginX"] = "-" + offsetX;
          } else {
            if (this.content?.animated) {
              style["--transformOrigin"] =
                "top " + this.getOppositeSide(position);
            }
            style["top"] = `calc(${this.anchorBox.top}px + ${offsetY})`;
          }
          break;
        case "center":
          if (position === "top" || position === "bottom") {
            if (this.content?.animated) {
              style["--transformOrigin"] =
                this.getOppositeSide(position) + " center";
            }
            style["left"] = `calc(${offsetX} + ${this.anchorBox.left}px)`;
            style["transform"] =
              `translateX( calc(-50% + (${this.anchorBox.width}px / 2) + ${offsetX}))`;
            style["--slideOriginX"] = `0px`;
          } else {
            if (this.content?.animated) {
              style["--transformOrigin"] =
                "center " + this.getOppositeSide(position);
            }
            style["top"] = `calc(${this.anchorBox.top}px + ${offsetY})`;
            style["transform"] =
              `translateY(calc(-50% + (${this.anchorBox.height}px / 2) + ${offsetY}))`;
            style["--slideOriginY"] =
              `calc(-0.5 * ((${this.anchorBox.width}px / 2) + ${offsetX}))`;
          }
          break;
        case "end":
          if (position === "top" || position === "bottom") {
            if (this.content?.animated) {
              style["--transformOrigin"] = "center";
            }
            style["right"] =
              `calc(100% - ${this.anchorBox.right}px + ${offsetX})`;
            style["--slideOriginX"] = offsetX;
          } else {
            if (this.content?.animated) {
              style["--transformOrigin"] =
                "bottom " + this.getOppositeSide(position);
            }
            style["bottom"] =
              `calc(100% - ${this.anchorBox.bottom}px + ${offsetY})`;
          }
          break;
      }

      const shift = this.viewportShift;
      if (shift?.x || shift?.y) style["translate"] = `${shift.x}px ${shift.y}px`;

      style["z-index"] = this.content?.dropdownZIndex || "unset";

      return style;
    },
  },
  methods: {
    handleClick(event) {
      if (
        this.content?.triggerType === "click" ||
        this.opensOnSmallScreenClick
      ) {
        if (!this.content?.disabled) {
          this.openingEvent = event;
          if (!this.isOpened) this.setCursorAnchor(event);
          this.isOpened = !this.isOpened;
        }
      }
    },
    closeDropdown() {
      this.isOpened = false;
    },
    handleContentClick(event) {
      if (!this.content?.closeOnContentClick || this.isEditing) return;
      // A nested dropdown's trigger opens that child; closing here would unmount it.
      const nestedTrigger = event?.target?.closest?.("[data-trigger-uid]");
      if (nestedTrigger && event.currentTarget?.contains?.(nestedTrigger)) return;
      this.isOpened = false;
    },
    handleHoverIn() {
      if (
        this.content?.triggerType === "hover" &&
        this.wwFrontState?.screenSize === "default" &&
        !this.isEditing
      ) {
        clearTimeout(this.timeoutId);
        if (!this.content?.disabled) this.isOpened = true;
      }
    },
    handleHoverOut() {
      if (this.content?.triggerType === "hover") {
        this.timeoutId = setTimeout(() => {
          if (!this.content?.disabled) this.isOpened = false;
        }, 200);
      }
    },
    handleRightClick(event) {
      if (
        this.content?.triggerType === "right-click" ||
        (this.wwFrontState?.screenSize !== "default" && !this.isEditing)
      ) {
        if (!this.content?.disabled) {
          this.openingEvent = event;
          // Like a native context menu: right-clicking again moves the menu to
          // the new pointer position instead of closing it.
          if (
            this.isOpened &&
            this.openAtCursor &&
            this.content?.triggerType === "right-click"
          ) {
            this.setCursorAnchor(event);
            return;
          }
          if (!this.isOpened) this.setCursorAnchor(event);
          this.isOpened = !this.isOpened;
        }
      }
    },
    getOppositeSide(side) {
      const transformations = {
        top: "bottom",
        bottom: "top",
        left: "right",
        right: "left",
      };

      return transformations[side];
    },
  },
};
</script>

<style lang="scss" scoped>
:root {
  --slideOriginX: 0px;
  --slideOriginY: 0px;
  --transformOrigin: top left;
}

.dropdown {
  position: fixed;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  transform-origin: var(--transformOrigin);
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translate(var(--slideOriginX), var(--slideOriginY)) scale(0.1);
}

@media (prefers-reduced-motion: reduce) {
  .slide-enter-active,
  .slide-leave-active {
    transition: opacity 0.2s ease;
  }

  .slide-enter-from,
  .slide-leave-to {
    transform: none;
  }
}
</style>
