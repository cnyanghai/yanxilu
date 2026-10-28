(function(){try{if(window.self===window.top)return;var p=window.parent&&window.parent.location;if(!p||p.origin!==location.origin)return;}catch(e){return;}
document.documentElement.setAttribute("data-embed","1");
document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;var u=new URL(a.href,location.href);if(u.origin===location.origin&&u.pathname==="/"){e.preventDefault();window.top.location.href=u.href;}},true);
})();