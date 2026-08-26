window.addEventListener("load", function () {
	var footer = document.getElementById("footer");
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.open("GET", "/pages/footer.html", false);
	xmlhttp.send();
	footer.innerHTML = xmlhttp.responseText;
});
