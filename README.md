
# Test Generation and Coverage

Continuous deployment and DevOps instrastructure cannot survive without tests. In this I have shown how to automatically generate tests, a process which can be triggered after a commit, or during other stages of the deployment pipeline.

### Since we are using istanbul package, make sure install this package using following command:  
     npm install istanbul -G
     
### Run main.js using following command:
    node main.js
  
### Executing following command:
    node_modules/.bin/istanbul cover test.js
    
### To help visualize coverage over the code, and get an accurate count of statements and branches you should open the following report that is generated:
    open coverage/lcov-report/TestGeneration/subject.js.html

### Code Coverage for both Subject.js and Mystery.js

![file](https://github.ncsu.edu/ddas5/HW2/blob/master/Screenshots/Screen%20Shot%202017-10-13%20at%208.25.34%20PM.png)

![file](https://github.ncsu.edu/ddas5/HW2/blob/master/Screenshots/Screen%20Shot%202017-10-13%20at%208.26.01%20PM.png)


