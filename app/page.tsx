import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>🎉 Word Party</Link>
            </div>
            <AuthButton />
          </div>
        </nav>

        <div className="flex-1 flex flex-col gap-12 max-w-4xl p-5 items-center justify-center text-center">
          <div className="flex flex-col gap-6">
            <h1 className="text-6xl font-bold">🎉 Word Party</h1>
            <p className="text-xl text-muted-foreground">
              Create hilarious stories with friends
            </p>
          </div>

          <div className="flex gap-4">
            {user ? (
              <Link href="/rooms">
                <Button size="lg">Go to Rooms</Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/sign-up">
                  <Button size="lg">Get Started</Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="lg" variant="outline">Sign In</Button>
                </Link>
              </>
            )}
          </div>

          <div className="grid gap-8 md:grid-cols-3 mt-8">
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-lg">Create a Room</h3>
              <p className="text-sm text-muted-foreground">
                Start a game room and invite your friends
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-lg">Submit Words</h3>
              <p className="text-sm text-muted-foreground">
                Fill in the blanks with creative words to complete the story
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-lg">Enjoy the Story</h3>
              <p className="text-sm text-muted-foreground">
                See the final story with AI-generated illustrations
              </p>
            </div>
          </div>
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <p>
            Powered by{" "}
            <a
              href="https://supabase.com"
              target="_blank"
              className="font-bold hover:underline"
              rel="noreferrer"
            >
              Supabase
            </a>
          </p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
