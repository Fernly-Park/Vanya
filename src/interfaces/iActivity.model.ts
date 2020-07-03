export interface IActivity {
    id: number
    name: string;
}

export class Activity implements IActivity {
    id: number;
    name: string;

    constructor(name: string, id = -1) {
        this.name = name;
        this.id = id;
    }
}