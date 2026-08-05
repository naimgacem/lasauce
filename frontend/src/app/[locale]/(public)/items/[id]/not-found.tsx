import { Link } from "@/i18n/navigation";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

/** Rendered with a real 404 status when `notFound()` fires in the page. */
export default function ItemNotFound() {
  return (
    <div className="container max-w-xl py-12">
      <ErrorState
        title="Item not found"
        message="This report may have been removed, or the link is incorrect."
      />
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link href={ROUTES.lost}>Browse lost items</Link>
        </Button>
        <Button asChild>
          <Link href={ROUTES.found}>Browse found items</Link>
        </Button>
      </div>
    </div>
  );
}
