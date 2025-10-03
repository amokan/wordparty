import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                📧 Check Your Email
              </CardTitle>
              <CardDescription>Almost there! Just one more step</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  We&apos;ve sent you a confirmation email. Please check your inbox and click the confirmation link to activate your account.
                </p>
                <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    💡 <strong>Tip:</strong> Don&apos;t forget to check your spam folder if you don&apos;t see the email.
                  </p>
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  After confirming your email, you can start creating rooms and playing with friends!
                </p>
              </div>

              <div className="text-center">
                <Link href="/auth/login" className="text-sm text-muted-foreground hover:underline">
                  ← Back to Login
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
