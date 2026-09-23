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
        <div @mouseenter="handleHoverIn" @mouseleave="handleHoverOut">
          <Transition :name="content.animated ? 'slide' : ''">
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
      return props.wwEditorState.isEditing;
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
      if (props.content.disabled) return;
      if (
        props.content.triggerType === "hover" &&
        props.wwFrontState.screenSize === "default"
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
        isOpened.value || (props.content.forceDisplayEditor && isEditing.value)
      );
    });
    const delayedIsOpen = ref(isDisplayed.value);
    const delayedIsClosed = ref(!isDisplayed.value);
    const timeoutId = ref(null);

    let resizeObserver = null;
    let scrollableParents = [];

    function setScrollableParents(element) {
      scrollableParents = [];
      let p = element.parentNode;
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
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        triggerBox.value.width = entry.contentRect.width;
        triggerBox.value.height = entry.contentRect.height;
      });
      resizeObserver.observe(triggerElementRef.value);
      setScrollableParents(triggerElementRef.value);
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
      clearTimeout(timeoutId.value);
    });

    watch(
      () => props.content.triggerType,
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
    style() {
      const style = {};
      const position = this.content.position;
      const alignment = this.content.alignment;

      const offsetX =
        this.content.offsetX !== undefined ? this.content.offsetX : "0px";
      const offsetY =
        this.content.offsetY !== undefined ? this.content.offsetY : "0px";

      switch (position) {
        case "top":
          style[
            "bottom"
          ] = `calc(100% - ${this.triggerBox.bottom}px + ${this.triggerBox.height}px + ${offsetY})`;
          break;
        case "bottom":
          style[
            "top"
          ] = `calc(${this.triggerBox.top}px + ${this.triggerBox.height}px + ${offsetY})`;
          break;
        case "left":
          style[
            "right"
          ] = `calc(100% - ${this.triggerBox.right}px + ${this.triggerBox.width}px + ${offsetX})`;
          break;
        case "right":
          style[
            "left"
          ] = `calc(${this.triggerBox.left}px + ${this.triggerBox.width}px + ${offsetX})`;
          break;
      }

      if (this.content.animated) {
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
            if (this.content.animated) {
              style["--transformOrigin"] =
                this.getOppositeSide(position) + " left";
            }
            style["left"] = `calc(${offsetX} + ${this.triggerBox.left}px)`;
            style["--slideOriginX"] = "-" + offsetX;
          } else {
            if (this.content.animated) {
              style["--transformOrigin"] =
                "top " + this.getOppositeSide(position);
            }
            style["top"] = `calc(${this.triggerBox.top}px + ${offsetY})`;
          }
          break;
        case "center":
          if (position === "top" || position === "bottom") {
            if (this.content.animated) {
              style["--transformOrigin"] =
                this.getOppositeSide(position) + " center";
            }
            style["left"] = `calc(${offsetX} + ${this.triggerBox.left}px)`;
            style["transform"] =
              `translateX( calc(-50% + (${this.triggerBox.width}px / 2) + ${offsetX}))`;
            style["--slideOriginX"] = `0px`;
          } else {
            if (this.content.animated) {
              style["--transformOrigin"] =
                "center " + this.getOppositeSide(position);
            }
            style["top"] = `calc(${this.triggerBox.top}px + ${offsetY})`;
            style["transform"] =
              `translateY(calc(-50% + (${this.triggerBox.height}px / 2) + ${offsetY}))`;
            style["--slideOriginY"] =
              `calc(-0.5 * ((${this.triggerBox.width}px / 2) + ${offsetX}))`;
          }
          break;
        case "end":
          if (position === "top" || position === "bottom") {
            if (this.content.animated) {
              style["--transformOrigin"] = "center";
            }
            style["right"] =
              `calc(100% - ${this.triggerBox.right}px + ${offsetX})`;
            style["--slideOriginX"] = offsetX;
          } else {
            if (this.content.animated) {
              style["--transformOrigin"] =
                "bottom " + this.getOppositeSide(position);
            }
            style["bottom"] =
              `calc(100% - ${this.triggerBox.bottom}px + ${offsetY})`;
          }
          break;
      }

      style["z-index"] = this.content.dropdownZIndex || "unset";

      return style;
    },
  },
  methods: {
    handleClick(event) {
      if (
        this.content.triggerType === "click" ||
        (this.wwFrontState.screenSize !== "default" && !this.isEditing)
      ) {
        if (!this.content.disabled) {
          this.openingEvent = event;
          this.isOpened = !this.isOpened;
        }
      }
    },
    closeDropdown() {
      this.isOpened = false;
    },
    handleHoverIn() {
      if (
        this.content.triggerType === "hover" &&
        this.wwFrontState.screenSize === "default" &&
        !this.isEditing
      ) {
        clearTimeout(this.timeoutId);
        if (!this.content.disabled) this.isOpened = true;
      }
    },
    handleHoverOut() {
      if (this.content.triggerType === "hover") {
        this.timeoutId = setTimeout(() => {
          if (!this.content.disabled) this.isOpened = false;
        }, 200);
      }
    },
    handleRightClick(event) {
      if (
        this.content.triggerType === "right-click" ||
        (this.wwFrontState.screenSize !== "default" && !this.isEditing)
      ) {
        if (!this.content.disabled) {
          this.openingEvent = event;
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
</style>
