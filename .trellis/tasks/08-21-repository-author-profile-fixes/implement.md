# Implementation Plan

1. Inventory and remove remote-provider fallback paths: local Git, cross-provider
   data, embedded/name-only identities, unknown authors, configured full profiles,
   cross-account substitutions, and swallowed identity/profile failures. Give
   Local an independent repository configuration.
2. Make GitHub require complete provider-API identities. Make Yunxiao resolve
   reviewed privacy-safe commit identities to exact usernames through the Codeup
   repository members API. Strengthen both validators and replace fallback-oriented
   tests with strict synchronization-failure and prior-snapshot-preservation tests.
3. Extend GitLab commit author types and projection so the existing reviewed
   identity mapping is resolved through the GitLab user API and reaches both UI
   consumers. Make endpoint, lookup, ambiguity, mismatch, and profile failures
   abort synchronization.
4. Add stable Gitee numeric account IDs and exact Gitee user lookup. Require the
   commit API and user API to identify the same account; preserve
   `9153520 / wl1983531544` for fixture commits and remove the invalid
   `10811655 / moluoxixi` substitution. Accept the exact account's provider-owned
   default avatar; reject missing identities, mismatches, unsafe profiles, and
   partial identities.
5. Strengthen every remote snapshot validator to require atomic complete author
   profiles, trusted provider URLs/routes, and exact account consistency.
6. Add provider-boundary tests proving remote collectors never invoke local Git
   or consume another provider snapshot. Model truly unavailable provider APIs as
   explicit unsupported capabilities, never runtime fallbacks.
7. Regenerate affected retained snapshots with explicit runtime credentials only
   when required. Review identity and privacy fields and prove representative
   failed syncs leave the previous snapshot byte-for-byte unchanged.
8. Run focused tests, lint, filtered type-check, aggregate metadata validation,
   production docs build, and browser acceptance on GitLab/Gitee local instances.
9. Update the provider quality spec with the provider-only source, strict failure,
   exact-account identity, unsupported-capability, and default-avatar contracts;
   then commit through the Trellis finish workflow.

## Review And Rollback Points

- Review each provider collector/type/test group before regenerating snapshots.
- Do not write any retained snapshot until collection and validation both pass.
- If a provider fixture cannot produce complete API-backed identities, stop and
  report the provider/API limitation; do not fabricate or downgrade the data.
- The collector/schema/config/snapshot changes roll back as one unit.
