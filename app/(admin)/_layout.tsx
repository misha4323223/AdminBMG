import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { LoadingView } from "@/components/ui";

export default function AdminLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingView />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
