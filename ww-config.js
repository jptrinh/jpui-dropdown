export default {
  editor: {
    label: {
      en: "Dropdown",
    },
    icon: "navigator-dropdown",
    navigator: {
      groups: ["Trigger", "Dropdown"],
    },
  },
  actions: [{ label: 'Close dropdown', action: 'closeDropdown' }],
  properties: {
    triggerType: {
      label: {
        en: "Trigger",
      },
      type: "TextSelect",
      defaultValue: "click",
      options: {
        options: [
          { value: "click", label: { en: "Click" } },
          { value: "hover", label: { en: "Hover" } },
          { value: "right-click", label: { en: "Right click" } }
        ],
      },
      bindable: true,
      classes: true,
      states: true,
      /* wwEditor:start */
      bindingValidation: {
        type: 'string',
        tooltip: 'A string that defines the trigger type of the dropdown. Possible values are click, hover, and right-click.',
      }
      /* wwEditor:end */
    },
    smallScreenClickFallback: {
      type: "OnOff",
      label: {
        en: "Open on click on smaller screens",
      },
      defaultValue: true,
      bindable: true,
      hidden: (content) => content?.triggerType !== "right-click",
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "A boolean that defines whether a plain click also opens a right-click dropdown on non-desktop breakpoints",
      },
      propertyHelp: "Touch screens have no right-click, so by default a plain click opens the dropdown on tablet and mobile breakpoints. Turn off when the trigger's own click does something else, such as selecting an item.",
      /* wwEditor:end */
    },
    position: {
      label: {
        en: "Position",
      },
      type: "TextSelect",
      defaultValue: "bottom",
      options: {
        options: [
          { value: "top", label: { en: "Top" } },
          { value: "right", label: { en: "Right" } },
          { value: "bottom", label: { en: "Bottom" } },
          { value: "left", label: { en: "Left" } },
        ],
      },
      bindable: true,
      classes: true,
      states: true,
      responsive: true,
      /* wwEditor:start */
      bindingValidation: {
        type: 'string',
        tooltip: 'A string that defines the position of the dropdown. Possible values are top, right, bottom, and left.',
      }
      /* wwEditor:end */
    },
    alignment: {
      label: { en: "Align" },
      type: "TextRadioGroup",
      options: (content) => {
        if (content.position === "top" || content.position === "bottom") {
          return {
            choices: [
              {
                value: "start",
                title: { en: "Start" },
                icon: "align-left",
              },
              {
                value: "center",
                title: { en: "Center" },
                icon: "align-center",
              },
              { value: "end", title: { en: "End" }, icon: "align-right" },
            ],
          };
        } else {
          return {
            choices: [
              {
                value: "start",
                title: { en: "Start" },
                icon: "align-y-start",
              },
              {
                value: "center",
                title: { en: "Center" },
                icon: "align-y-center",
              },
              { value: "end", title: { en: "End" }, icon: "align-y-end" },
            ],
          };
        }
      },
      defaultValue: "start",
      bindable: true,
      classes: true,
      states: true,
      responsive: true,
      /* wwEditor:start */
      bindingValidation: {
        type: 'string',
        tooltip: 'A string that defines the alignment of the dropdown. Possible values are start, center, and end.',
      }
      /* wwEditor:end */
    },
    openAtCursor: {
      type: "OnOff",
      label: {
        en: "Open at cursor",
      },
      defaultValue: false,
      bindable: true,
      hidden: (content) => content?.triggerType === "hover",
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "A boolean that defines whether the dropdown is positioned at the pointer instead of relative to the trigger",
      },
      propertyHelp: "Position and alignment then apply around the pointer: Bottom + Start puts the panel's top-left corner at the cursor, like a native context menu.",
      /* wwEditor:end */
    },
    offsetX: {
      type: "Length",
      label: {
        en: "Offset (x)",
        fr: "Taille",
      },
      bindable: true,
      options: {
        unitChoices: [
          { value: "px", label: "px", min: 1, max: 1000 },
          { value: "%", label: "%", min: 1, max: 100 },
        ],
        noRange: true,
        useVar: true,
      },
      /* wwEditor:start */
      bindingValidation: {
        type: 'string',
        tooltip: 'A string that defines size of offset in px or %',
      }
      /* wwEditor:end */
    },
    offsetY: {
      type: "Length",
      label: {
        en: "Offset (y)",
        fr: "Taille",
      },
      bindable: true,
      options: {
        unitChoices: [
          { value: "px", label: "px", min: 1, max: 1000 },
          { value: "%", label: "%", min: 1, max: 100 },
        ],
        noRange: true,
        useVar: true,
      },
      /* wwEditor:start */
      bindingValidation: {
        type: 'string',
        tooltip: 'A string that defines size of offset in px or %',
      }
      /* wwEditor:end */
    },
    keepInViewport: {
      type: "OnOff",
      label: {
        en: "Keep in viewport",
      },
      defaultValue: true,
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "A boolean that defines whether the dropdown flips and shifts to stay inside the viewport",
      },
      propertyHelp: "When the panel would overflow the screen, it flips to the opposite side of the trigger (e.g. bottom to top) if there is more room there, then shifts to stay 8px inside the edges.",
      /* wwEditor:end */
    },
    triggerLayout: {
      hidden: true,
      defaultValue: [],
      navigator: {
        group: "Trigger",
      },
    },
    dropdownLayout: {
      hidden: true,
      defaultValue: [],
      navigator: {
        group: "Dropdown",
      },
    },
    dropdownZIndex: {
      label: 'Dropdown z-index',
      type: 'Number',
      options: {
        min: 0,
        max: 100,
      },
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: "number",
        tooltip: "A number that defines the Z-index of the dropdown.",
      },
      /* wwEditor:end */
    },
    disabled: {
      type: "OnOff",
      label: {
        en: "Disabled",
      },
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "A boolean that defines the disabled state`",
      },
      /* wwEditor:end */
    },
    animated: {
      type: "OnOff",
      label: {
        en: "Animated",
      },
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "A boolean that defines whether element is animated",
      },
      /* wwEditor:end */
    },
    closeOnEscape: {
      type: "OnOff",
      label: {
        en: "Close on Escape",
      },
      defaultValue: true,
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "A boolean that defines whether pressing Escape closes the dropdown",
      },
      /* wwEditor:end */
    },
    closeOnContentClick: {
      type: "OnOff",
      label: {
        en: "Close on content click",
      },
      defaultValue: false,
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "A boolean that defines whether a click inside the dropdown closes it",
      },
      /* wwEditor:end */
    },
    forceDisplayEditor: {
      type: "OnOff",
      label: {
        en: "Force display in editor",
      }
    },
  },
};
