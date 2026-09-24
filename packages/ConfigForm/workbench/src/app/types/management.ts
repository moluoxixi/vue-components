/**
 * The two sibling management consoles of the Workbench/Studio application.
 *
 * Project management owns the project list; page management owns the pages of
 * the project that is open. They are peers in the application chrome, not
 * nested screens, so either one can be reached from the other in one click.
 */
export type WorkbenchManagementTarget = 'projects' | 'pages'
