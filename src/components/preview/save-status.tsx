"use client";

import { useTranslations } from "next-intl";

interface SaveStatusProps {
  saving: boolean;
  modified: boolean;
}

export function SaveStatus({ saving, modified }: SaveStatusProps) {
  const t = useTranslations("preview");
  const tCommon = useTranslations("common");

  const text = saving
    ? t("autoSaving")
    : modified
      ? tCommon("modified")
      : "";

  if (!text) return null;

  return (
    <span className="text-xs text-muted-foreground">{text}</span>
  );
}
