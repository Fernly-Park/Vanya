import AWS from 'aws-sdk';
import initApp from '@App/app';
import http from 'http';
import { setupForTestAgainstServer, stateMachinesForTests, dummyRoleARN } from '@Tests/testHelper';

describe('tests the flow of a simple state machine with only a pass state', () => {
    let server: http.Server;
    let stepFunctions: AWS.StepFunctions;

    beforeAll(async done => {
        const app = await initApp()
        server = http.createServer(app);
        server.listen(3000, 'localhost', 511, done);
    });

    beforeEach(async () => {
        stepFunctions = await setupForTestAgainstServer()
    });

    afterAll(done => {
        server.close(done);
    })

    const createHelloWorldSM = async (name?: string) => {
        return await stepFunctions.createStateMachine({definition: 
            stateMachinesForTests.valid.validPassWithResult, 
            roleArn: dummyRoleARN, 
            name: name ?? 'stateMachineName'}).promise();
    }
    
    it('should work', async () => {
        expect.assertions(0);

        const createdStateMachine = await createHelloWorldSM();
        const startedExecution = await stepFunctions.startExecution({stateMachineArn: createdStateMachine.stateMachineArn}).promise();
    });
})