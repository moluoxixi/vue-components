# Designer Overlay Interaction Regression

## Root Cause

The Runtime form is intentionally inert in Design mode, but editor feedback is
rendered in a separate overlay layer. When selection, drop candidates, policy
diagnostics, resize affordances, and the pointer-following visual are allowed
to render independently, more than one frame can describe the same node. A
selection outline that touches a real input is then easily mistaken for a
component-library focus ring even though the input never received focus.

This is an editor-chrome state problem, not a ConfigForm Runtime problem.

## Required Prevention

- Derive all editor feedback from one finite overlay mode: `idle`, `selected`,
  `keyboard-dragging`, `pointer-dragging`, or `resizing`.
- Pointer dragging hides stale selection and policy overlays. The Runtime
  candidate remains the measured structural preview and the pointer-following
  visual is the only detailed drag copy.
- Resize keeps the active selection and resize handle only. Its lifecycle must
  clear on commit, cancel, readonly transitions, and unmount.
- Selection chrome must have an explicit visual gap from the Runtime box so it
  cannot be read as a native or library focus ring.
- Policy diagnostics are contextual and belong to the primary selected node;
  they must not be emitted for every adapter node in the document.
- Browser regression tests must assert Runtime inertness, overlay focus, mode
  transitions, overlay counts, and measured geometry for pointer drag,
  keyboard drag, nested targets, and resize. DOM class assertions alone are
  insufficient.

## Review Questions

Before adding an editor affordance, answer:

1. Which overlay mode owns it?
2. Which existing affordance does it replace or suppress?
3. Does its geometry come from a registered Runtime node?
4. Does the browser test prove that it does not block nested hit testing or
   make a Runtime control appear editable?
