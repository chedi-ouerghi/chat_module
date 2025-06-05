import type { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = () => {
  return new Response("Not Found", {
    status: 404,
    statusText: "Not Found",
  });
};

export default function CatchAll() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
        <p className="text-gray-600">La page demandée n'existe pas.</p>
      </div>
    </div>
  );
}
