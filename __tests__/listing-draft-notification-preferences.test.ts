import { describe, expect, it } from "vitest";
import {
  emptyListingDraftFormState,
  formStateToDraftPayload,
} from "@/components/seller-dashboard/listing-wizard/listingDraftFormAdapters";

describe("listingDraftFormAdapters notification preferences", () => {
  it("maps persisted notification preferences to the API payload", () => {
    const form = emptyListingDraftFormState();
    form.notifications = {
      inApp: false,
      browser: true,
      emailFuture: false,
      externalIntegrationFuture: false,
    };

    expect(formStateToDraftPayload(form)).toMatchObject({
      notifyInApp: false,
      notifyBrowser: true,
      notifyEmailFuture: false,
      notifyExternalFuture: false,
    });
  });
});
