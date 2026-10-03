import { ACCENT, Header } from "../_hire/header";
import { PostForm } from "../_hire/post-form";

export default function PostPage() {
  return (
    <div style={ACCENT} className="flex min-h-full flex-1 flex-col">
      <Header />
      <PostForm />
    </div>
  );
}
