
function fibonacci(n){
  var s = 0;
  if (n == 0){
    return(s);
  }
  if (n == 1){
    s += 1;
    return(s);
  }
  else {
    return (fibonacci(n - 1) + fibonacci(n - 2));
  }
}

//test 
// var results = [];
// for(var i=0; i<10; i++){
  // results.push(fibonacci(i));
// }
// alert(results.join(" "));
