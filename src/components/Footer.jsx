export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-6 z-50">
      <div className="text-center text-sm text-slate-600">
        Powered By <a 
          href="https://www.botivate.in" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 font-medium"
          data-testid="link-botivate"
        >
          Botivate
        </a> - www.botivate.in
      </div>
    </footer>
  );
}
