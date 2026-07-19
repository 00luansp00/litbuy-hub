import type {
  AccountProvenance,
  AccountRecoveryLevel,
  ListingAccountInfo,
  ListingAttributeConfig,
  ListingAttributeValue,
  ListingDeliveryMode,
  ListingModel,
  ListingNotificationPreferences,
  ListingProductType,
  ListingServiceInfo,
  ListingServicePricingType,
  ListingVariant,
  SellerPlanType,
} from "@/types";
import type {
  DraftPayload,
  ListingDraftAccountDetails,
  ListingDraftRecord,
  ListingDraftServiceDetails,
} from "@/services/listingDraftApiService";

export type FormPromotionTier = "silver" | "gold" | "diamond";

export type ListingDraftFormState = {
  id: string | null;
  status: ListingDraftRecord["status"];
  version: number;
  step: number;
  model: ListingModel;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategorySlug: string | null;
  subcategoryName: string | null;
  productType: ListingProductType | null;
  title: string;
  description: string;
  price: string;
  stock: string;
  deliveryMode: ListingDeliveryMode;
  promotionTier: FormPromotionTier;
  sellerPlan: SellerPlanType;
  autoMessage: string;
  notifications: ListingNotificationPreferences;
  attributes: ListingAttributeValue[];
  variants: ListingVariant[];
  service: ListingServiceInfo;
  account: ListingAccountInfo;
  rejectionCode: string | null;
  rejectionReason: string | null;
  updatedAt: string | null;
};

export const EMPTY_DRAFT_ID = "00000000-0000-4000-8000-000000000000";

const modelApiToForm: Record<ListingDraftRecord["model"], ListingModel> = {
  NORMAL: "normal",
  DYNAMIC: "dynamic",
  SERVICE: "service",
};
const modelFormToApi: Record<ListingModel, DraftPayload["model"]> = {
  normal: "NORMAL",
  dynamic: "DYNAMIC",
  service: "SERVICE",
};
const deliveryApiToForm: Record<ListingDraftRecord["deliveryMode"], ListingDeliveryMode> = {
  MANUAL: "manual",
  AUTOMATIC: "automatic",
};
const deliveryFormToApi: Record<ListingDeliveryMode, DraftPayload["deliveryMode"]> = {
  manual: "MANUAL",
  automatic: "AUTOMATIC",
};
const promotionApiToForm: Record<ListingDraftRecord["requestedPromotionTier"], FormPromotionTier> =
  {
    SILVER: "silver",
    GOLD: "gold",
    DIAMOND: "diamond",
  };
const promotionFormToApi: Record<FormPromotionTier, DraftPayload["requestedPromotionTier"]> = {
  silver: "SILVER",
  gold: "GOLD",
  diamond: "DIAMOND",
};
const planApiToForm: Record<ListingDraftRecord["requestedSellerPlan"], SellerPlanType> = {
  STANDARD: "standard",
  LIT_MAX: "lit_max",
};
const planFormToApi: Record<SellerPlanType, DraftPayload["requestedSellerPlan"]> = {
  standard: "STANDARD",
  lit_max: "LIT_MAX",
};
const variantApiToFormStatus: Record<"ACTIVE" | "PAUSED", ListingVariant["status"]> = {
  ACTIVE: "active",
  PAUSED: "paused",
};
const variantFormToApiStatus: Record<ListingVariant["status"], "ACTIVE" | "PAUSED"> = {
  active: "ACTIVE",
  paused: "PAUSED",
};
const servicePricingApiToForm: Record<"FIXED" | "QUOTE", ListingServicePricingType> = {
  FIXED: "fixed",
  QUOTE: "quote",
};
const servicePricingFormToApi: Record<ListingServicePricingType, "FIXED" | "QUOTE"> = {
  fixed: "FIXED",
  quote: "QUOTE",
};
const provenanceApiToForm: Record<string, AccountProvenance> = {
  ORIGINAL_OWNER: "original_owner",
  RESELLER: "reseller",
  THIRD_PARTY: "third_party",
  OTHER: "other",
};
const provenanceFormToApi: Record<AccountProvenance, string> = {
  original_owner: "ORIGINAL_OWNER",
  reseller: "RESELLER",
  third_party: "THIRD_PARTY",
  other: "OTHER",
};
const recoveryLevelApiToForm: Record<string, AccountRecoveryLevel> = {
  FULL: "full",
  PARTIAL: "partial",
  NONE: "none",
  UNKNOWN: "unknown",
};
const recoveryLevelFormToApi: Record<AccountRecoveryLevel, string> = {
  full: "FULL",
  partial: "PARTIAL",
  none: "NONE",
  unknown: "UNKNOWN",
};
const riskApiToForm: Record<string, NonNullable<ListingAccountInfo["recoveryRisk"]>> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};
const riskFormToApi: Record<NonNullable<ListingAccountInfo["recoveryRisk"]>, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

export function apiVariantToFormVariant(
  variant: ListingDraftRecord["variants"][number],
): ListingVariant {
  return {
    id: variant.id,
    title: variant.title,
    description: variant.description ?? "",
    price: Number(variant.price),
    stock: variant.stock,
    status: variantApiToFormStatus[variant.status],
  };
}

export function formVariantToApiVariant(variant: ListingVariant, sortOrder: number) {
  return {
    title: variant.title,
    description: variant.description || null,
    price: Number(variant.price || 0).toFixed(2),
    stock: Math.max(0, Math.trunc(Number(variant.stock) || 0)),
    status: variantFormToApiStatus[variant.status],
    sortOrder,
  };
}

export function apiServiceDetailsToForm(
  details: ListingDraftServiceDetails | null,
): ListingServiceInfo {
  return {
    title: details?.title ?? "",
    description: details?.description ?? "",
    pricingType: details?.pricingType ? servicePricingApiToForm[details.pricingType] : undefined,
    basePrice: details?.basePrice ? Number(details.basePrice) : undefined,
    estimatedDelivery: details?.estimatedDelivery ?? "",
    buyerRequirements: details?.buyerRequirements ?? "",
    notes: details?.notes ?? "",
  };
}

export function formServiceDetailsToApi(
  service: ListingServiceInfo,
): NonNullable<DraftPayload["serviceDetails"]> {
  const pricingType = service.pricingType ? servicePricingFormToApi[service.pricingType] : null;
  return {
    title: service.title || null,
    description: service.description || null,
    pricingType,
    basePrice:
      pricingType === "QUOTE" || service.basePrice == null
        ? null
        : Number(service.basePrice).toFixed(2),
    estimatedDelivery: service.estimatedDelivery || null,
    buyerRequirements: service.buyerRequirements || null,
    notes: service.notes || null,
  };
}

export function apiAccountDetailsToForm(
  details: ListingDraftAccountDetails | null,
): ListingAccountInfo {
  return {
    provenance: details?.provenance ? provenanceApiToForm[details.provenance] : undefined,
    recoveryLevel: details?.recoveryLevel
      ? recoveryLevelApiToForm[details.recoveryLevel]
      : undefined,
    emailVerified: details?.emailVerified ?? false,
    phoneLinked: details?.phoneLinked ?? false,
    documentLinked: details?.documentLinked ?? false,
    fullAccess: details?.fullAccess ?? false,
    recoveryRisk: details?.recoveryRisk ? riskApiToForm[details.recoveryRisk] : undefined,
    warrantyNote: details?.warrantyNote ?? "",
  };
}

export function formAccountDetailsToApi(
  account: ListingAccountInfo,
): NonNullable<DraftPayload["accountDetails"]> {
  return {
    provenance: account.provenance ? provenanceFormToApi[account.provenance] : null,
    recoveryLevel: account.recoveryLevel ? recoveryLevelFormToApi[account.recoveryLevel] : null,
    emailVerified: account.emailVerified ?? null,
    phoneLinked: account.phoneLinked ?? null,
    documentLinked: account.documentLinked ?? null,
    fullAccess: account.fullAccess ?? null,
    recoveryRisk: account.recoveryRisk ? riskFormToApi[account.recoveryRisk] : null,
    warrantyNote: account.warrantyNote || null,
  };
}

export function emptyListingDraftFormState(): ListingDraftFormState {
  return {
    id: null,
    status: "DRAFT",
    version: 1,
    step: 1,
    model: "normal",
    categoryId: null,
    categorySlug: null,
    categoryName: null,
    subcategoryId: null,
    subcategorySlug: null,
    subcategoryName: null,
    productType: null,
    title: "",
    description: "",
    price: "",
    stock: "",
    deliveryMode: "manual",
    promotionTier: "silver",
    sellerPlan: "standard",
    autoMessage: "",
    notifications: {
      inApp: true,
      browser: false,
      emailFuture: false,
      externalIntegrationFuture: false,
    },
    attributes: [],
    variants: [],
    service: apiServiceDetailsToForm(null),
    account: apiAccountDetailsToForm(null),
    rejectionCode: null,
    rejectionReason: null,
    updatedAt: null,
  };
}

export function sellerDraftDetailToFormState(draft: ListingDraftRecord): ListingDraftFormState {
  return {
    ...emptyListingDraftFormState(),
    id: draft.id,
    status: draft.status,
    version: draft.version,
    step: draft.wizardStep,
    model: modelApiToForm[draft.model],
    categoryId: draft.categoryId,
    categorySlug: draft.category?.slug ?? null,
    categoryName: draft.category?.name ?? null,
    subcategoryId: draft.subcategoryId,
    subcategorySlug: draft.subcategory?.slug ?? null,
    subcategoryName: draft.subcategory?.name ?? null,
    productType: draft.productType,
    title: draft.title ?? "",
    description: draft.description ?? "",
    price: draft.price ?? "",
    stock: draft.stock == null ? "" : String(draft.stock),
    deliveryMode: deliveryApiToForm[draft.deliveryMode],
    promotionTier: promotionApiToForm[draft.requestedPromotionTier],
    sellerPlan: planApiToForm[draft.requestedSellerPlan],
    autoMessage: draft.autoMessage ?? "",
    notifications: draft.notifications,
    attributes: draft.attributes,
    variants: [...draft.variants]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(apiVariantToFormVariant),
    service: apiServiceDetailsToForm(draft.serviceDetails),
    account: apiAccountDetailsToForm(draft.accountDetails),
    rejectionCode: draft.rejectionCode,
    rejectionReason: draft.rejectionReason,
    updatedAt: draft.updatedAt,
  };
}

export function filterAttributesForConfig(
  attributes: ListingAttributeValue[],
  config: ListingAttributeConfig[],
): ListingAttributeValue[] {
  const allowed = new Set(config.map((field) => field.key));
  return attributes.filter((attribute) => allowed.has(attribute.key));
}

export function formStateToDraftPayload(form: ListingDraftFormState): DraftPayload {
  const price = form.price.trim() ? Number(form.price).toFixed(2) : null;
  const stock = form.stock.trim() ? Math.max(0, Math.trunc(Number(form.stock) || 0)) : null;
  return {
    model: modelFormToApi[form.model],
    categoryId: form.categoryId,
    subcategoryId: form.subcategoryId,
    productType: form.productType,
    title: form.model === "service" ? form.service.title || form.title || null : form.title || null,
    description:
      form.model === "service"
        ? form.service.description || form.description || null
        : form.description || null,
    price: form.model === "normal" ? price : null,
    stock: form.model === "normal" ? stock : null,
    deliveryMode: deliveryFormToApi[form.deliveryMode],
    requestedPromotionTier: promotionFormToApi[form.promotionTier],
    requestedSellerPlan: planFormToApi[form.sellerPlan],
    autoMessage: form.autoMessage || null,
    wizardStep: form.step,
    attributes: form.attributes,
    variants: form.model === "dynamic" ? form.variants.map(formVariantToApiVariant) : [],
    serviceDetails: form.model === "service" ? formServiceDetailsToApi(form.service) : null,
    accountDetails:
      form.productType === "account" && form.model !== "service"
        ? formAccountDetailsToApi(form.account)
        : null,
  };
}
