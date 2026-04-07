import { Outlet } from "react-router-dom";

/** Parent for `/campaigns` and `/campaigns/import-email` so nested routes resolve under React Router v6. */
export default function CampaignsLayout() {
  return <Outlet />;
}
