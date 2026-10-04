import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/server/auth";

export const metadata = { title: "Вход" };
export const dynamic = "force-dynamic";

/** Уже авторизованного пользователя сразу отправляем в кабинет. */
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) {
    const { next } = await searchParams;
    redirect(next && next.startsWith("/app") ? next : "/app");
  }
  return <AuthForm mode="login" />;
}
