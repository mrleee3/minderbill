# Desktop workspace

Desktop layout activates at 1100 CSS pixels. Narrower windows retain the mobile navigation and sliding sheets.

## Scope

- Fixed sidebar navigation and a screen title with task context
- Today: attendance list beside the editor, direct date selection, save without closing, persistent Save control
- Children: name search and contract/diary/invoice sections in one detail panel
- Invoices: list beside the preview/actions, direct month selection, All / To generate / Unpaid / Paid filters using the latest invoice version
- Month: calendar beside the selected day's attendance, with a direct link to edit that day
- Settings: bounded form width; secondary desktop overlays have a bounded width

## Interaction safeguards

- Desktop attendance and contract forms warn before navigating away with unsaved changes
- Saved attendance updates the existing record rather than adding duplicates
- Child/date-specific editor keys keep state with the correct entry
- The same form remains mounted when resizing between desktop panels and mobile sheets
- Existing billing calculations, storage schema, PDF generation and iPhone viewport settings are unchanged

## Verification

The desktop integration suite runs the actual React components against an isolated IndexedDB implementation. It covers repeated saving, unsaved-change protection, child isolation, contract/diary switching, invoice selection and filters, mobile sheet dismissal, and retaining drafts across a breakpoint change.

The cloud browser cannot access the local preview. Visual browser verification is performed against the deployed build; physical iPhone behaviour still requires an on-device check.
