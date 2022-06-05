import {
    getJsonForWSDL,
    getWSDLServices,
    findWSDLForServiceName,
    getSwaggerForService
} from "apiconnect-wsdl"

import { path as ramdaPath } from 'ramda';

import { mkdir, readFile, writeFile} from "fs";

import * as path from "path"

export const name = 'WSDL';

const zippedWSDL = "./haha.zip";

const outputFolder = "output";

mkdir(outputFolder, (err) =>{});

const processFile = async (err,data) => {
    if(err) {
        console.log("Could not read file: " + err);
        return;
    }

    const wsdl = await getJsonForWSDL(data);
    const { services } = getWSDLServices(wsdl);

    if(services.length === 0) {
        console.log('No services found in the wsdl. Exiting.');
        return;
    }

    const items = services.map(({ service, filename }) => {
        const wsdlEntry = findWSDLForServiceName(wsdl, service);
        return getSwaggerForService(wsdlEntry, service, filename);
    });

    const result = JSON.stringify(convertToPostman(items));

    console.log(result)

    const savePath = path.join(process.cwd(), outputFolder, "translated.postman");

    console.log("\n\n\n\n\nSaving to: " + savePath);

    writeFile(savePath, result, (err) => {if(err) console.log(err)});
}

const convertToPostman = (items) => {
    console.log(items)
    const item = items.map(swagger => {
        const item = [];
        const url = swagger['x-ibm-configuration'].assembly.execute[0].proxy['target-url'];

        for (const path of Object.keys(swagger.paths)) {
            const methods = swagger.paths[path];

            for (const method of Object.keys(methods)) {
                const api = methods[method];
                const paths = api.parameters[0].schema.$ref.split('/');
                paths.shift();
                paths.push('example');
                const example = ramdaPath(paths, swagger);
                item.push({
                    name: api.operationId,
                    description: api.description || '',
                    request: {
                        url,
                        method,
                        header: [
                            {
                                key: 'SOAPAction',
                                value: api['x-ibm-soap']['soap-action'],
                                disabled: false,
                            },
                            {
                                key: 'Content-Type',
                                value: swagger.consumes[0],
                                disabled: false,
                            },
                            {
                                key: 'Accept',
                                value: swagger.produces[0],
                                disabled: false,
                            },
                        ],
                        body: {
                            mode: 'raw',
                            raw: example,
                        },
                    },
                });
            }
        }

        return {
            name: swagger.info.title,
            item,
        };
    });
    return {
        info: {
            name: items[0].info.title,
            schema: 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json', // required
        },
        item,
    };
};

readFile(zippedWSDL, processFile);